import { type NextRequest, NextResponse } from 'next/server';
import { deleteAttachment } from '@/lib/fsNotes';
import { getUserDataDir } from '@/lib/auth';
import { errorResponse } from '@/lib/apiHelpers';

interface RouteParams { params: Promise<{ id: string; attId: string }> }

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id, attId } = await params;
    await deleteAttachment(id, attId, root);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
