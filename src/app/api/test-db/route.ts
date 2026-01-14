import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';

export async function GET() {
    try {
        await connectToDatabase();
        return NextResponse.json({ status: 'success', message: 'MongoDB Connected Successfully' });
    } catch (error: unknown) {
        console.error('DB Connection Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
