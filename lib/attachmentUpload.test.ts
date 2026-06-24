import { describe, expect, test } from 'bun:test';

import type { Attachment } from './fsNotes';
import { appendLinks, buildMarkdownLink } from './attachmentUpload';

const att = (over: Partial<Attachment>): Attachment => ({
  id: 'abc123',
  originalName: 'file.bin',
  mimeType: 'application/octet-stream',
  size: 0,
  relativePath: 'attachments/abc123_file.bin',
  ...over,
});

describe('buildMarkdownLink', () => {
  test('image → image embed syntax', () => {
    const link = buildMarkdownLink(att({ originalName: 'pic.png', mimeType: 'image/png' }), 'n1');
    expect(link).toBe('![pic.png](/api/notes/n1/attachments/abc123/download)');
  });

  test('non-image (video) → plain link syntax', () => {
    const link = buildMarkdownLink(att({ originalName: 'clip.mp4', mimeType: 'video/mp4' }), 'n1');
    expect(link).toBe('[clip.mp4](/api/notes/n1/attachments/abc123/download)');
  });
});

describe('appendLinks', () => {
  const links = ['[a](/a)', '[b](/b)'];

  test('empty links → content unchanged', () => {
    expect(appendLinks('hello', [])).toBe('hello');
  });

  test('empty content → no leading separator', () => {
    expect(appendLinks('', links)).toBe('[a](/a)\n[b](/b)\n');
  });

  test('content without trailing newline → separator inserted', () => {
    expect(appendLinks('text', links)).toBe('text\n[a](/a)\n[b](/b)\n');
  });

  test('content ending in newline → no extra separator', () => {
    expect(appendLinks('text\n', links)).toBe('text\n[a](/a)\n[b](/b)\n');
  });

  test('single link', () => {
    expect(appendLinks('text', ['[a](/a)'])).toBe('text\n[a](/a)\n');
  });
});
