import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/googleSheets';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

export async function GET() {
    try {
        const sheets = await getGoogleSheets();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A1:Z1', // Fetch header row only
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
