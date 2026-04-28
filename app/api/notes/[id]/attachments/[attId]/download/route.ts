import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { getAttachmentFilePath } from '@/lib/fsNotes';
import { getUserDataDir } from '@/lib/auth';
import { errorResponse } from '@/lib/apiHelpers';

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

    // Per RFC 6266: legacy `filename=` carries display chars in a quoted
    // string (sanitize \ and " for safety); modern `filename*` (RFC 5987)
    // is percent-encoded UTF-8 and wins on browsers that support it.
    const safeFilename = fileName.replace(/[\\"]/g, '_');
    const encoded = encodeURIComponent(fileName);
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encoded}`,
        'Content-Length': String(stat.size),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
