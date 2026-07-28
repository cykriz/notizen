import { describe, expect, test } from 'bun:test';
import { markdownToPlainText, splitIntoSpeechChunks } from './markdownToPlainText';

describe('markdownToPlainText', () => {
  test('heading keeps text and gains a trailing period', () => {
    expect(markdownToPlainText('# Titel')).toBe('Titel.');
    expect(markdownToPlainText('## Schon mit Punkt.')).toBe('Schon mit Punkt.');
  });

  test('fenced code blocks are dropped, surrounding text kept', () => {
    const md = 'Vor\n```js\nconst x = 1;\n```\nNach';
    const out = markdownToPlainText(md);
    expect(out).toContain('Vor');
    expect(out).toContain('Nach');
    expect(out).not.toContain('const x');
  });

  test('link text is kept, URL dropped', () => {
    expect(markdownToPlainText('Siehe [Beispiel](https://example.com)')).toBe('Siehe Beispiel');
  });

  test('images are removed entirely', () => {
    expect(markdownToPlainText('Text ![alt](img.png) mehr')).toBe('Text mehr');
  });

  test('checkboxes strip the box, keep the label', () => {
    expect(markdownToPlainText('- [ ] Aufgabe eins\n- [x] Aufgabe zwei')).toBe('Aufgabe eins\nAufgabe zwei');
  });

  test('list bullets are stripped', () => {
    expect(markdownToPlainText('- eins\n- zwei\n1. drei')).toBe('eins\nzwei\ndrei');
  });

  test('emphasis and inline code markers are stripped', () => {
    expect(markdownToPlainText('**fett** und *kursiv* mit `code`')).toBe('fett und kursiv mit code');
  });

  test('table renders cells as a comma list, no pipes or separators', () => {
    const out = markdownToPlainText('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(out).toContain('A, B');
    expect(out).toContain('1, 2');
    expect(out).not.toContain('|');
    expect(out).not.toContain('---');
  });

  test('title is prepended', () => {
    expect(markdownToPlainText('Inhalt', 'Mein Titel')).toBe('Mein Titel. Inhalt');
  });

  test('empty input yields empty string', () => {
    expect(markdownToPlainText('')).toBe('');
    expect(markdownToPlainText('   \n  ')).toBe('');
  });

  test('leading frontmatter is stripped', () => {
    expect(markdownToPlainText('---\ntitle: X\n---\nInhalt')).toBe('Inhalt');
  });
});

describe('splitIntoSpeechChunks', () => {
  test('empty text yields no chunks', () => {
    expect(splitIntoSpeechChunks('')).toEqual([]);
    expect(splitIntoSpeechChunks('   ')).toEqual([]);
  });

  test('short text is a single chunk', () => {
    expect(splitIntoSpeechChunks('Hallo Welt.')).toEqual(['Hallo Welt.']);
  });

  test('paragraphs become separate chunks', () => {
    expect(splitIntoSpeechChunks('Absatz eins.\n\nAbsatz zwei.')).toEqual(['Absatz eins.', 'Absatz zwei.']);
  });

  test('sentences pack up to maxLen', () => {
    expect(splitIntoSpeechChunks('Eins. Zwei. Drei.', 12)).toEqual(['Eins. Zwei.', 'Drei.']);
  });

  test('overlong run is hard-split at word boundaries, each chunk within maxLen', () => {
    const chunks = splitIntoSpeechChunks('aaaa bbbb cccc dddd', 6);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(6);
    }
    expect(chunks.join(' ')).toBe('aaaa bbbb cccc dddd');
  });

  test('a single word longer than maxLen is emitted whole (never char-split)', () => {
    const word = 'x'.repeat(20);
    expect(splitIntoSpeechChunks(word, 6)).toEqual([word]);
  });
});
