import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/googleSheets';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sheets = await getGoogleSheets();

        // 1. Get first sheet name dynamically (Prioritize 'JEE Modules')
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheetList = meta.data.sheets || [];
        const specificSheet = sheetList.find(s => s.properties?.title === 'JEE Modules');
        const targetSheetValid = specificSheet ? specificSheet.properties?.title : (sheetList[0]?.properties?.title || 'Sheet1');
        const targetSheet = targetSheetValid || 'Sheet1';

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${targetSheet}'!A1:Z1`, // Fetch header row of target sheet
        });

        return NextResponse.json({
            headers: response.data.values ? response.data.values[0] : [],
            indices: response.data.values ? response.data.values[0].map((h, i) => `${i}: ${h}`) : []
        });
    } catch (error: unknown) {
        console.error('Debug API Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
