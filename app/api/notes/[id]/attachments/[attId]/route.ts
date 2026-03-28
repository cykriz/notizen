import { type NextRequest, NextResponse } from "next/server";
import { deleteAttachment } from "@/lib/fsNotes";
import { errorResponse } from "@/lib/apiHelpers";

interface RouteParams { params: Promise<{ id: string; attId: string }> }

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, attId } = await params;
    await deleteAttachment(id, attId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, { notFoundAs404: true });
  }
}
