import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Allotment from '@/models/Allotment';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.email) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();

        // Fetch allotments assigned to this teacher
        // We filter by teacherEmail.
        const allotments = await Allotment.find({
            teacherEmail: session.user.email
        }).sort({ sheetRowId: 1 });

        return NextResponse.json({ data: allotments });
    } catch (error: unknown) {
        console.error('Fetch Allotments Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
