import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Allotment from '@/models/Allotment';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { id, videoLink, questionErrorIdentified, status } = await req.json();

        if (!id) {
            return NextResponse.json({ message: 'Missing ID' }, { status: 400 });
        }

        await connectToDatabase();

        // Verify ownership
        const allotment = await Allotment.findOne({ _id: id, teacherEmail: session.user.email });

        if (!allotment) {
            return NextResponse.json({ message: 'Allotment not found or unauthorized' }, { status: 404 });
        }

        // Update fields
        if (videoLink !== undefined) allotment.videoLink = videoLink;
        if (questionErrorIdentified !== undefined) allotment.questionErrorIdentified = questionErrorIdentified;

        // Auto-update status logic possible here
        if (status) allotment.status = status;
        else if (videoLink && !allotment.status) allotment.status = 'Completed';

        allotment.lastSyncedAt = new Date();
        await allotment.save();

        // --- WRITE-BACK TO GOOGLE SHEET ---
        try {
            const log = (msg: string) => console.log(`[Update-Allotment] ${msg}`);

            log(`Starting Write-Back for Row ID: ${allotment.sheetRowId}`);
            log(`Sheet Title: "${allotment.sheetTitle}"`);
            log(`Video Col Index: ${allotment.videoLinkCol}`);
            log(`Error Col Index: ${allotment.errorCol}`);
            log(`Video Value: "${videoLink}"`);
            log(`Error Value: "${questionErrorIdentified}"`);

            if (allotment.sheetTitle && allotment.sheetRowId) {
                const { getGoogleSheets } = await import('@/lib/googleSheets');
                const sheets = await getGoogleSheets();
                const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

                const updates = [];

                // Helper to convert 0-based index to Column Letter
                const getColLetter = (colIndex: number) => {
                    let temp, letter = '';
                    while (colIndex >= 0) {
                        temp = (colIndex) % 26;
                        letter = String.fromCharCode(temp + 65) + letter;
                        colIndex = Math.floor((colIndex) / 26) - 1;
                    }
                    return letter;
                };

                // Update Video Link if changed
                if (videoLink !== undefined && allotment.videoLinkCol !== undefined && allotment.videoLinkCol >= 0) {
                    const colLetter = getColLetter(allotment.videoLinkCol);
                    const range = `'${allotment.sheetTitle}'!${colLetter}${allotment.sheetRowId}`;
                    log(`Prepare Update Video: Range=${range}, Val=${videoLink}`);
                    updates.push({ range, values: [[videoLink]] });

                    // Smart Feature: Auto-fill "Link Addition Date" if link is added and column is known
                    if (videoLink && videoLink.length > 5 && allotment.linkDateCol !== undefined && allotment.linkDateCol >= 0) {
                        const today = new Date().toLocaleDateString('en-US'); // MM/DD/YYYY format usually best for Sheets
                        const dateColLetter = getColLetter(allotment.linkDateCol);
                        const dateRange = `'${allotment.sheetTitle}'!${dateColLetter}${allotment.sheetRowId}`;
                        log(`Prepare Update Link Date: Range=${dateRange}, Val=${today}`);
                        updates.push({
                            range: dateRange,
                            values: [[today]]
                        });
                    }
                } else {
                    log(`Skipping Video Update: Val=${videoLink}, Col=${allotment.videoLinkCol}`);
                }

                // Update Error if changed
                if (questionErrorIdentified !== undefined && allotment.errorCol !== undefined && allotment.errorCol >= 0) {
                    const colLetter = getColLetter(allotment.errorCol);
                    const range = `'${allotment.sheetTitle}'!${colLetter}${allotment.sheetRowId}`;
                    log(`Prepare Update Error: Range=${range}, Val=${questionErrorIdentified}`);
                    updates.push({ range, values: [[questionErrorIdentified]] });
                }

                // Execute Updates
                if (updates.length > 0) {
                    log(`Sending batchUpdate with ${updates.length} items...`);
                    try {
                        const res = await sheets.spreadsheets.values.batchUpdate({
                            spreadsheetId: SPREADSHEET_ID,
                            requestBody: {
                                valueInputOption: 'USER_ENTERED',
                                data: updates
                            }
                        });
                        log(`✅ Success! Response: ${JSON.stringify(res.data)}`);
                        console.log(`✅ Write-back successful for Row ${allotment.sheetRowId}`);
                    } catch (apiErr: unknown) {
                        log(`❌ API Error: ${(apiErr as Error).message}`);
                        console.error('API Error', apiErr);
                    }
                } else {
                    log('No updates generated to send.');
                }
            } else {
                log('❌ Missing Sheet Title or Row ID');
            }
        } catch (wbError: unknown) {
            console.error('⚠️ Write-back Failed:', wbError);
            // Logging to console for Vercel compatibility
        }

        return NextResponse.json({ message: 'Updated successfully', data: allotment });

    } catch (error: unknown) {
        console.error('Update Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
