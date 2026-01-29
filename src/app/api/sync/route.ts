import { NextResponse } from 'next/server';
import fs from 'fs';
import { getGoogleSheets } from '@/lib/googleSheets';
import connectToDatabase from '@/lib/db';
import Allotment from '@/models/Allotment';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

export async function POST() {
    try {
        const sheets = await getGoogleSheets();

        // 1. Get Metadata for ALL sheets
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheetList = meta.data.sheets || [];
        if (sheetList.length === 0) throw new Error('No sheets found');

        let targetSheetTitle = '';
        let headerRowIndex = -1;
        let foundHeaders: string[] = [];

        // STRATEGY 1: Check "JEE Modules" specifically
        const specificSheet = sheetList.find(s => s.properties?.title === 'JEE Modules');
        if (specificSheet) {
            const title = 'JEE Modules';
            console.log(`Prioritizing sheet: ${title}`);
            try {
                const rangeRes = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${title}'!A1:Z5`,
                });
                const rowsPreview = rangeRes.data.values || [];
                for (let i = 0; i < rowsPreview.length; i++) {
                    const rowStr = rowsPreview[i].join(' ').toLowerCase();
                    if (rowStr.includes('cohort') && rowStr.includes('subject')) {
                        headerRowIndex = i;
                        targetSheetTitle = title;
                        foundHeaders = rowsPreview[i];
                        console.log(`✅ Found Valid Headers in "${title}" at Row ${i + 1}`);
                        break;
                    }
                }
            } catch (e) {
                console.warn(`Error checking prioritized sheet ${title}:`, e);
            }
        }

        // STRATEGY 2: Fallback to searching ALL sheets if not found yet
        if (!targetSheetTitle) {
            for (const sheet of sheetList) {
                const title = sheet.properties?.title || '';
                if (title === 'JEE Modules') continue; // Already checked

                console.log(`Checking sheet: ${title}`);
                try {
                    const rangeRes = await sheets.spreadsheets.values.get({
                        spreadsheetId: SPREADSHEET_ID,
                        range: `'${title}'!A1:Z5`,
                    });
                    const rowsPreview = rangeRes.data.values || [];
                    for (let i = 0; i < rowsPreview.length; i++) {
                        const rowStr = rowsPreview[i].join(' ').toLowerCase();
                        if (rowStr.includes('cohort') && rowStr.includes('subject') && rowStr.includes('class')) {
                            headerRowIndex = i;
                            targetSheetTitle = title;
                            foundHeaders = rowsPreview[i];
                            console.log(`✅ Found Valid Headers in "${title}" at Row ${i + 1}`);
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`Error checking sheet ${title}:`, e);
                    continue;
                }
                if (targetSheetTitle) break;
            }
        }

        if (!targetSheetTitle) {
            throw new Error('Could not find a sheet with columns: Cohort, Subject, Class');
        }

        const sheetTitle = targetSheetTitle;
        const headers = foundHeaders;
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());
        console.log(`Headers found at Row ${headerRowIndex + 1}:`, headers);

        // Helper to find index by keyword
        const findIndex = (keywords: string[]) =>
            lowerHeaders.findIndex(h => keywords.some(k => h.includes(k)));

        // Map critical columns
        const map = {
            sheetRowId: findIndex(['#', 'sr.', 'no.']),
            cohort: findIndex(['cohort']),
            class: findIndex(['class']),
            subject: findIndex(['subject']),
            module: findIndex(['module']),
            chapterNo: findIndex(['chapter no', 'chap no', 'chapter number']),
            chapterName: findIndex(['chapter name']),
            exercise: findIndex(['exercise']),
            qNo: findIndex(['q. no', 'question no']),
            qbg: findIndex(['links', 'qbg id links']),
            textSol: findIndex(['text solution', 'text sol']),
            ppt: findIndex(['ppt']),
            videoFolder: findIndex(['video folder']),
            videoLink: findIndex(['video link']),
            error: findIndex(['error', 'identified']),
            vsLinkDate: findIndex(['vs link addition', 'addition date', 'link date']),
            vsAllotDate: findIndex(['vs allotment', 'allotment date', 'allotment']),
            status: findIndex(['status']),
            email: findIndex(['allotted to', 'vs allotted', 'teacher', 'email']),
        };

        console.log('Column Mapping identified:', map);

        // 3. Fetch Data starting from AFTER header row
        const dataStartRow = headerRowIndex + 2;
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${targetSheetTitle}'!A${dataStartRow}:Z`,
        });

        const rows = dataResponse.data.values;

        // LOGGING
        try {
            let logMsg = `\n--- SYNC START ${new Date().toISOString()} ---\n`;
            logMsg += `Target Sheet: "${targetSheetTitle}" (Row ${headerRowIndex + 1})\n`;
            logMsg += `Headers Found: ${JSON.stringify(headers)}\n`;
            logMsg += `Mappings: VideoLink=${map.videoLink}, Error=${map.error}, Email=${map.email}\n`;
            logMsg += `Rows Fetched: ${rows ? rows.length : 0}\n`;
            fs.appendFileSync('sync-log.txt', logMsg, 'utf8');
        } catch (e) { console.error("Log failed", e); }

        if (!rows || rows.length === 0) {
            return NextResponse.json({ message: 'No data found in sheet' }, { status: 200 });
        }

        await connectToDatabase();

        const operations = rows.map((row, index) => {
            const sheetRowId = dataStartRow + index;
            const getVal = (idx: number) => (idx >= 0 ? row[idx] || '' : '');
            const emailIdx = map.email >= 0 ? map.email : 16;

            const rawVideoLink = getVal(map.videoLink);
            const rawStatus = getVal(map.status);

            let derivedStatus = rawStatus;
            if (!derivedStatus && rawVideoLink && rawVideoLink.length > 5) {
                derivedStatus = 'Submitted';
            } else if (!derivedStatus) {
                derivedStatus = 'Pending';
            }

            return {
                updateOne: {
                    filter: { sheetRowId: sheetRowId },
                    update: {
                        $set: {
                            sheetRowId,
                            cohort: getVal(map.cohort),
                            class: getVal(map.class),
                            subject: getVal(map.subject),
                            moduleNo: getVal(map.module),
                            chapterNumber: getVal(map.chapterNo),
                            chapterName: getVal(map.chapterName),
                            exerciseName: getVal(map.exercise),
                            qNo: getVal(map.qNo),
                            qbgIdLinks: getVal(map.qbg),
                            textSolutionAvailable: getVal(map.textSol),
                            pptLink: getVal(map.ppt),
                            videoFolderLink: getVal(map.videoFolder),
                            videoLink: rawVideoLink,
                            questionErrorIdentified: getVal(map.error),
                            vsLinkAdditionDate: getVal(map.vsLinkDate),
                            vsAllotmentDate: getVal(map.vsAllotDate),
                            status: derivedStatus,
                            teacherEmail: getVal(emailIdx),
                            sheetTitle: targetSheetTitle,
                            videoLinkCol: map.videoLink,
                            errorCol: map.error,
                            linkDateCol: map.vsLinkDate,
                        }
                    },
                    upsert: true
                }
            };
        });

        await Allotment.bulkWrite(operations);

        return NextResponse.json({
            message: 'Sync successful',
            count: rows.length,
            mappedSheet: sheetTitle,
            mapping: map
        });

    } catch (error: unknown) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
