import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { getAttachmentFilePath } from "@/lib/fsNotes";

interface RouteParams { params: Promise<{ id: string; attId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, attId } = await params;
    const { filePath, fileName, mimeType } = await getAttachmentFilePath(id, attId);

    const stat = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(stat.size),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
