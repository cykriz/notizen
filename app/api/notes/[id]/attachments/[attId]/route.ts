import { type NextRequest, NextResponse } from "next/server";
import { deleteAttachment } from "@/lib/fsNotes";

interface RouteParams { params: Promise<{ id: string; attId: string }> }

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, attId } = await params;
    await deleteAttachment(id, attId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
