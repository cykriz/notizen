import { test, expect, type Page } from '@playwright/test';
import { createNote, deleteAllNotes, noteIdFromUrl } from './helpers';

// The indent width is a single config key (`tabSize: 4` in components/markdownEditorSetup.ts),
// which basicSetup turns into CodeMirror's `indentUnit` facet. It has no other trace in the repo:
// remove it and the editor silently falls back to the library default of 2 spaces, with nothing
// failing. Hence these tests — and hence the expected strings below spell the four spaces out
// literally instead of importing the setting they are meant to guard.

/** The markdown as it was actually written to disk. The preview only shows *that* something
 *  nested, never how many spaces did it — so this is the only read that can fail on a wrong
 *  indent width.
 *
 *  A failed request is returned as text rather than thrown: this runs inside `expect.poll`,
 *  where a throw aborts the whole poll instead of being retried. As a value it just shows up
 *  in the diff, so a persistently broken route still reads as "received: … → 404". */
async function savedContent(page: Page, url: string): Promise<string> {
  const res = await page.request.get(`/api/notes/${noteIdFromUrl(url)}`);
  if (!res.ok()) {
    return `GET /api/notes/<id> → ${res.status().toString()}`;
  }

  return ((await res.json()) as { content: string }).content;
}

/** Autosave is debounced by 1000ms (hooks/useAutoSave.ts), and a keystroke sequence longer than
 *  that produces several PUTs — so waiting for *a* save would read an intermediate state on a
 *  slow machine. Polling waits for the state that is actually being asserted. */
async function expectSaved(page: Page, url: string, expected: string): Promise<void> {
  await expect.poll(() => savedContent(page, url), { timeout: 15_000 }).toBe(expected);
}

test.describe('Listen-Einrückung', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await deleteAllNotes(page);
    await page.reload();
  });

  // Both directions in one note, because Shift+Tab is not the inverse of Tab by construction:
  // indentMore inserts the unit, while indentLess re-computes the column and rebuilds the
  // indent from it. A unit that only half-changed would show up here and nowhere else.
  test('Tab rückt Bullet-Listen um 4 Spaces ein, Shift+Tab wieder aus', async ({ page }) => {
    const url = await createNote(page, 'Bullet-Einrückung', '- a');

    // Enter continues the list (`- `), Tab then indents that whole line.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('b');
    // Third level: continuation keeps b's own indent of 4, Tab makes it 8.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('c');
    // …and back to b's level, which only holds if exactly one unit came off.
    await page.keyboard.press('Shift+Tab');

    await expectSaved(page, url, '- a\n    - b\n    - c');

    // 4 spaces still *nest*: a child indented four or more columns past its parent's content
    // column would be an indented code block instead. `- a` puts its content in column 2, so
    // 4 is inside the item — this reload proves the parser agrees, not just the editor.
    await page.reload();
    const preview = page.locator('.wmde-markdown');
    await expect(preview.locator('ul ul li')).toHaveCount(2);
    await expect(preview.locator('pre')).toHaveCount(0);
  });

  test('Tab rückt nummerierte Listen um 4 Spaces ein', async ({ page }) => {
    const url = await createNote(page, 'Ordered-Einrückung', '1. a');

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('b');

    // The `2.` comes from the list continuation, which counts up before the line is indented —
    // it is not affected by the indent width and stays as it is once the line moves.
    await expectSaved(page, url, '1. a\n    2. b');
  });

  test('Tab rückt Checkboxen um 4 Spaces ein', async ({ page }) => {
    const url = await createNote(page, 'Checkbox-Einrückung', '- [ ] a');

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type('b');

    // The task marker widens the line but not the indent: `- [ ] ` is still a `- ` marker with
    // content in column 2, so its children sit at the same 4 as a plain bullet's.
    await expectSaved(page, url, '- [ ] a\n    - [ ] b');
  });
});
