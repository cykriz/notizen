import { type NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { getAttachmentFilePath } from "@/lib/fsNotes";
import { getUserDataDir } from "@/lib/auth";
import { errorResponse } from "@/lib/apiHelpers";

interface RouteParams { params: Promise<{ id: string; attId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id, attId } = await params;
    const { filePath, fileName, mimeType } = await getAttachmentFilePath(id, attId, root);

    const stat = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    // Type-narrow Node→Web stream
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(stat.size),
      },
    });
  } catch (err) {
    return errorResponse(err, { notFoundAs404: true });
  }
}
