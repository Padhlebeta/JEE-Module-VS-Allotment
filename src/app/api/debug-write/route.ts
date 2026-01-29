import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Allotment from '@/models/Allotment';
import { getGoogleSheets } from '@/lib/googleSheets';

export async function GET() {
    try {
        await connectToDatabase();
        
        // Get all allotments with write-back metadata
        const allotments = await Allotment.find({}).select(
            'sheetRowId teacherEmail sheetTitle videoLinkCol errorCol linkDateCol status videoLink questionErrorIdentified'
        );

        const sheets = await getGoogleSheets();
        const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

        // Categorize issues
        const issues = {
            missingSheetTitle: [] as any[],
            invalidColumnIndices: [] as any[],
            sheetAccessErrors: [] as any[],
            validRows: [] as any[]
        };

        for (const row of allotments) {
            const rowData = {
                rowId: row.sheetRowId,
                email: row.teacherEmail,
                status: row.status,
                sheetTitle: row.sheetTitle,
                videoLinkCol: row.videoLinkCol,
                errorCol: row.errorCol,
                linkDateCol: row.linkDateCol
            };

            // Check 1: Missing Sheet Title
            if (!row.sheetTitle) {
                issues.missingSheetTitle.push(rowData);
                continue;
            }

            // Check 2: Invalid Column Indices
            if (
                row.videoLinkCol === undefined || 
                row.videoLinkCol < 0 || 
                row.errorCol === undefined || 
                row.errorCol < 0
            ) {
                issues.invalidColumnIndices.push(rowData);
                continue;
            }

            // Check 3: Test if sheet range is accessible
            try {
                const colLetter = getColLetter(row.videoLinkCol);
                const testRange = `'${row.sheetTitle}'!${colLetter}${row.sheetRowId}`;
                
                await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: testRange
                });

                issues.validRows.push(rowData);
            } catch (err: any) {
                issues.sheetAccessErrors.push({
                    ...rowData,
                    error: err.message
                });
            }
        }

        // Summary
        const summary = {
            total: allotments.length,
            missingSheetTitle: issues.missingSheetTitle.length,
            invalidColumnIndices: issues.invalidColumnIndices.length,
            sheetAccessErrors: issues.sheetAccessErrors.length,
            validRows: issues.validRows.length
        };

        return NextResponse.json({
            summary,
            issues,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Debug Write Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper to convert column index to letter
function getColLetter(colIndex: number): string {
    let temp, letter = '';
    while (colIndex >= 0) {
        temp = colIndex % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
    }
    return letter;
}
