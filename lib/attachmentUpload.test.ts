import { describe, expect, test } from 'bun:test';

import type { Attachment } from './fsNotes';
import { appendLinks, buildMarkdownLink, removeAttachmentLink } from './attachmentUpload';

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

describe('removeAttachmentLink', () => {
  const noteId = 'n1';
  const id = 'abc12345';
  const url = `/api/notes/${noteId}/attachments/${id}/download`;

  test('file link alone on its own line → removed with its newline', () => {
    const content = `before\n[clip.mp4](${url})\nafter`;
    expect(removeAttachmentLink(content, id, noteId)).toBe('before\nafter');
  });

  test('image link (![…]) is removed too', () => {
    const content = `intro\n![pic.png](${url})\nrest`;
    expect(removeAttachmentLink(content, id, noteId)).toBe('intro\nrest');
  });

  test('inline link within a text line → stripped in place, surrounding text kept', () => {
    const content = `see [clip.mp4](${url}) here`;
    expect(removeAttachmentLink(content, id, noteId)).toBe('see  here');
  });

  test('link as the last line without trailing newline', () => {
    const content = `text\n[clip.mp4](${url})`;
    expect(removeAttachmentLink(content, id, noteId)).toBe('text');
  });

  test('filename containing "]" is still removed (non-greedy match)', () => {
    const content = `x\n[[v1] clip.mp4](${url})\ny`;
    expect(removeAttachmentLink(content, id, noteId)).toBe('x\ny');
  });

  test('multiple occurrences of the same attId → all removed', () => {
    const content = `[a.pdf](${url})\nmiddle\n[a.pdf](${url})\nend`;
    expect(removeAttachmentLink(content, id, noteId)).toBe('middle\nend');
  });

  test('other attId is left untouched', () => {
    const otherUrl = `/api/notes/${noteId}/attachments/99999999/download`;
    const content = `[keep.pdf](${otherUrl})\n[gone.pdf](${url})`;
    expect(removeAttachmentLink(content, id, noteId)).toBe(`[keep.pdf](${otherUrl})`);
  });

  test('content without a matching link is unchanged', () => {
    const content = 'just some text\nwith lines';
    expect(removeAttachmentLink(content, id, noteId)).toBe(content);
  });
});
