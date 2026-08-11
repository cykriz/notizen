import { describe, expect, it } from 'bun:test';
import { buildNoteSavePayload } from './noteSavePayload';

describe('buildNoteSavePayload', () => {
  it('sends both fields for a normal title', () => {
    expect(buildNoteSavePayload('Titel', 'Inhalt')).toEqual({ title: 'Titel', content: 'Inhalt' });
  });

  // The regression this file exists for: `title: ''` is a 400 from the route's
  // min(1), a 400 is non-retryable, and the rejected payload took the content with
  // it — so an emptied title silently stopped the note from saving at all.
  it('omits an empty title instead of sending it', () => {
    const payload = buildNoteSavePayload('', 'Inhalt');
    expect(payload).toEqual({ content: 'Inhalt' });
    expect('title' in payload).toBe(false);
  });

  it('treats a whitespace-only title as empty', () => {
    expect(buildNoteSavePayload('   ', 'Inhalt')).toEqual({ content: 'Inhalt' });
    expect(buildNoteSavePayload('\t\n ', 'Inhalt')).toEqual({ content: 'Inhalt' });
  });

  it('keeps a title that only has surrounding whitespace, untrimmed', () => {
    // Trimming is the emptiness *test*, not a transform: the user's spacing is theirs.
    expect(buildNoteSavePayload('  Titel  ', 'Inhalt')).toEqual({
      title: '  Titel  ',
      content: 'Inhalt',
    });
  });

  it('still sends empty content — only the title has a min(1) on the server', () => {
    expect(buildNoteSavePayload('Titel', '')).toEqual({ title: 'Titel', content: '' });
  });
});
