import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { getAttachmentFilePath } from '@/lib/fsNotes';
import { getUserDataDir } from '@/lib/auth';
import { errorResponse } from '@/lib/apiHelpers';
import { contentDisposition } from '@/lib/contentDisposition';

interface RouteParams { params: Promise<{ id: string; attId: string }> }

interface ByteRange { start: number; end: number }

/**
 * Parse a single-range `Range` header against a known file size.
 * Returns a satisfiable range, `null` (no/invalid/multi range → full 200), or
 * `'unsatisfiable'` (→ 416). `end` is inclusive (matches HTTP and Node streams).
 */
function parseRange(header: string | null, size: number): ByteRange | null | 'unsatisfiable' {
  if (header === null) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null) {
    return null;
  } // malformed or multiple ranges → serve full

  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') {
    return null;
  }

  let start: number;
  let end: number;
  if (startStr === '') {
    // Suffix range: last N bytes.
    const n = Number(endStr);
    if (n === 0) {
      return 'unsatisfiable';
    }

    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === '' ? size - 1 : Number(endStr);
  }

  if (start >= size) {
    return 'unsatisfiable';
  }

  if (start > end) {
    return null;
  }

  if (end >= size) {
    end = size - 1;
  }

  return { start, end };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const root = await getUserDataDir();
    const { id, attId } = await params;
    const { filePath, fileName, mimeType } = await getAttachmentFilePath(id, attId, root);

    const stat = await fs.stat(filePath);
    const size = stat.size;

    const baseHeaders: Record<string, string> = {
      'Content-Type': mimeType,
      'Content-Disposition': contentDisposition(fileName, { inline: false }),
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };

    const range = parseRange(request.headers.get('range'), size);
    if (range === 'unsatisfiable') {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${String(size)}`, 'Accept-Ranges': 'bytes' },
      });
    }

    // Range request → 206 with the requested byte slice (enables seeking and
    // Safari/iOS media playback, which refuses to play without 206 support).
    if (range !== null) {
      const { start, end } = range;
      const nodeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${String(start)}-${String(end)}/${String(size)}`,
          'Content-Length': String(end - start + 1),
        },
      });
    }

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      headers: { ...baseHeaders, 'Content-Length': String(size) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
