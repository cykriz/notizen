import { type NextRequest, NextResponse } from 'next/server';
import { listAttachments, saveAttachment, getNote } from '@/lib/fsNotes';
import { getUserDataDir } from '@/lib/auth';
import { errorResponse } from '@/lib/apiHelpers';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id } = await params;
    const note = await getNote(id, root);

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const attachments = await listAttachments(id, root);
    return NextResponse.json(attachments);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send as multipart/form-data with key 'file'" },
        { status: 400 }
      );
    }

    const attachment = await saveAttachment(id, file, root);
    return NextResponse.json(attachment, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
