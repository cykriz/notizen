import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { z } from 'zod';
import { NotFoundError, getAttachmentFilePath } from '@/lib/fsNotes';
import { getShare } from '@/lib/fsShares';
import { userRootFor } from '@/lib/fsHelpers';
import { INLINE_SAFE_MIMES, SHARE_CACHE_CONTROL } from '@/lib/constants';
import { contentDisposition } from '@/lib/contentDisposition';

const AttIdSchema = z.string().regex(/^[a-f0-9]{8}$/);

interface RouteParams {
  params: Promise<{ token: string; attId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token, attId } = await params;
    if (!AttIdSchema.safeParse(attId).success) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const share = await getShare(token);
    if (!share) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    // A valid share token grants read access to every attachment of the shared
    // note, not just the ones referenced in the markdown body. The token is the
    // gate (256 bits of entropy); attId is just an opaque filename prefix.
    const { filePath, fileName, mimeType } = await getAttachmentFilePath(
      share.noteId,
      attId,
      userRootFor(share.username),
    );

    const stat = await fs.stat(filePath);
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    const safeInline = INLINE_SAFE_MIMES.includes(mimeType);
    const contentType = safeInline ? mimeType : 'application/octet-stream';
    const disposition = contentDisposition(fileName, { inline: safeInline });

    // Cache-Control is also set by the proxy for /share/; duplicated here as
    // defense-in-depth so revocation/expiry stays effective even if a future
    // refactor moves header handling.
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': String(stat.size),
        'Cache-Control': SHARE_CACHE_CONTROL,
        'Content-Security-Policy': "default-src 'none'; sandbox; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    console.error('share attachment error', err);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
