import { describe, expect, test } from 'bun:test';
import { contentDisposition } from './contentDisposition';

describe('contentDisposition', () => {
  test('attachment is the default disposition type', () => {
    expect(contentDisposition('note.pdf', { inline: false })).toBe(
      'attachment; filename="note.pdf"; filename*=UTF-8\'\'note.pdf',
    );
  });

  test('inline is used for the safe-to-render MIME types', () => {
    expect(contentDisposition('bild.png', { inline: true })).toBe(
      'inline; filename="bild.png"; filename*=UTF-8\'\'bild.png',
    );
  });

  test('quotes and backslashes are neutralised in the legacy filename only', () => {
    const value = contentDisposition('a"b\\c.txt', { inline: false });
    expect(value).toContain('filename="a_b_c.txt"');
    // The RFC 5987 form keeps the real name, percent-encoded.
    expect(value).toContain('filename*=UTF-8\'\'a%22b%5Cc.txt');
  });

  test('umlauts and spaces survive verbatim in filename= and encoded in filename*', () => {
    const value = contentDisposition('Über uns.pdf', { inline: false });
    expect(value).toContain('filename="Über uns.pdf"');
    expect(value).toContain('filename*=UTF-8\'\'%C3%9Cber%20uns.pdf');
  });
});
