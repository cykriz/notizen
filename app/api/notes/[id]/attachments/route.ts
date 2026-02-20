import { type NextRequest, NextResponse } from "next/server";
import { listAttachments, saveAttachment, getNote } from "@/lib/fsNotes";

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const note = await getNote(id);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const attachments = await listAttachments(id);
    return NextResponse.json(attachments);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send as multipart/form-data with key 'file'" },
        { status: 400 }
      );
    }

    const attachment = await saveAttachment(id, file);
    return NextResponse.json(attachment, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
