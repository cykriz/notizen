import { test, expect, type Locator, type Page } from '@playwright/test';
import { deleteAllNotes, watchForHydrationErrors } from './helpers';

// Enough notes to overflow the 300px result box (~6 rows), so "is the top hit visible" is a
// real question and not trivially true.
const FILLER_COUNT = 12;
// Shared by every filler title AND by the target, so one query matches all of them: the list
// stays long enough to scroll while the ranking still has to put the target on top.
const COMMON_WORD = 'Projekt';
const TARGET_TITLE = `${COMMON_WORD} Alpha`;
const TARGET_TAG = 'arbeit/alpha';
const PINNED_TITLE = `${COMMON_WORD} Angepinnt`;

// The ids matter. `defaultFilter` used to score the CommandItem value — the note id — as part
// of the haystack, so a UUID beginning with the query outscored a real title match. Giving the
// decoy an id starting with 'abc' and the target the matching *title* reproduces that exactly:
// before the fix the decoy won (0.99 vs 0.89).
const HEX_QUERY = 'abc';
const DECOY_ID = 'abc12345-4b8e-11ee-9f21-0242ac120002';
const DECOY_TITLE = 'Wocheneinkauf';
const HEX_TARGET_ID = 'f0e1d2c3-4b8e-11ee-9f21-0242ac120002';
const HEX_TARGET_TITLE = 'ABC-Analyse';

/** The scroll container cmdk renders — the element carrying max-h/overflow-y. */
function resultList(page: Page): Locator {
  return page.locator('[data-slot=command-list]');
}

function rows(page: Page): Locator {
  return page.locator('[cmdk-item]');
}

/** Create a note through the API — far faster than driving the editor, and the only way to
 *  pin down the id, which is what the ranking regression hinges on. */
async function apiCreateNote(
  page: Page,
  note: { title: string; id?: string; tags?: string[]; pinned?: boolean },
): Promise<void> {
  const res = await page.request.post('/api/notes', {
    data: {
      title: note.title,
      content: 'Inhalt',
      tags: note.tags ?? [],
      ...(note.id === undefined ? {} : { id: note.id }),
    },
  });
  expect(res.ok(), `POST /api/notes failed for ${note.title}: ${res.status().toString()}`).toBe(true);

  if (note.pinned === true) {
    const created = (await res.json()) as { id: string };
    const put = await page.request.put(`/api/notes/${created.id}`, { data: { pinned: true } });
    expect(put.ok(), `PUT pinned failed for ${note.title}`).toBe(true);
  }
}

async function openPalette(page: Page): Promise<Locator> {
  const input = page.getByPlaceholder('Suchen…');

  // CommandPalette is loaded via dynamic(ssr:false), so right after a navigation its window
  // listener for Mod+P is not attached yet and the very first press is simply swallowed
  // (verified — a second press a moment later always lands). Pressing only while the dialog
  // is still closed keeps this from toggling it shut again.
  await expect(async () => {
    if (!(await input.isVisible())) {
      await page.keyboard.press('ControlOrMeta+p');
    }

    await expect(input).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  return input;
}

async function scrollTopOf(page: Page): Promise<number> {
  return await resultList(page).evaluate((el) => el.scrollTop);
}

test.describe('Befehlspalette', () => {
  let hydrationErrors: string[];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto('/notes');
    await deleteAllNotes(page);

    // Oldest first: without ranking the target would sit at the very bottom of the list,
    // which is the state the bug produced.
    await apiCreateNote(page, { title: TARGET_TITLE, tags: [TARGET_TAG] });
    await apiCreateNote(page, { title: DECOY_TITLE, id: DECOY_ID });
    await apiCreateNote(page, { title: HEX_TARGET_TITLE, id: HEX_TARGET_ID });
    for (let i = 0; i < FILLER_COUNT; i++) {
      await apiCreateNote(page, { title: `${COMMON_WORD} Füller ${String(i)}` });
    }
    await apiCreateNote(page, { title: PINNED_TITLE, pinned: true });

    // Reload so the freshly created notes are in the client list.
    await page.goto('/notes');
    await expect(page.getByText(PINNED_TITLE).first()).toBeVisible();
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  test('bester Treffer steht oben und ist ohne Scrollen sichtbar', async ({ page }) => {
    const input = await openPalette(page);
    await input.fill(TARGET_TITLE);

    await expect(rows(page).first()).toHaveText(new RegExp(TARGET_TITLE));
    await expect(rows(page).first()).toBeInViewport();
    expect(await scrollTopOf(page)).toBe(0);
  });

  test('eine Hex-Eingabe trifft keine Notiz nur wegen ihrer id', async ({ page }) => {
    const input = await openPalette(page);
    await input.fill(HEX_QUERY);

    await expect(rows(page).first()).toHaveText(new RegExp(HEX_TARGET_TITLE));
    // Scoped to the palette rows on purpose: the note also sits in the sidebar behind the
    // dialog, so a page-wide text locator would match that instead.
    await expect(rows(page).filter({ hasText: DECOY_TITLE })).toHaveCount(0);
  });

  test('eine neue Eingabe beginnt oben, auch wenn die Liste gescrollt war', async ({ page }) => {
    const input = await openPalette(page);
    // Matches every filler, so the list is long enough to scroll.
    await input.fill(COMMON_WORD);
    await expect(rows(page).first()).toBeVisible();

    // Set the offset directly instead of mouse.wheel: the list is a nested scroller inside a
    // portal, where wheel events are unreliable.
    await resultList(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await scrollTopOf(page)).toBeGreaterThan(0);

    // Refining the query is what used to leave the offset untouched — the top hit stayed above
    // the fold and you had to scroll up to reach it.
    await input.fill(TARGET_TITLE);

    await expect(rows(page).first()).toHaveText(new RegExp(TARGET_TITLE));
    await expect(rows(page).first()).toBeInViewport();
    expect(await scrollTopOf(page)).toBe(0);
  });

  // The case cmdk cannot handle by itself: it only scrolls when the *selected* row changes.
  // Scrolling by wheel leaves the selection alone, and refining the query in a way that keeps
  // the same row on top leaves it alone too — so its scrollIntoView never fires and the offset
  // survives with the best hit above the fold. This is what the reset in CommandList is for.
  test('Scrollen und Tippen ohne Wechsel des Top-Treffers setzt den Scroll zurück', async ({ page }) => {
    const input = await openPalette(page);
    await input.fill(COMMON_WORD);
    const topRow = await rows(page).first().textContent();

    await resultList(page).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await scrollTopOf(page)).toBeGreaterThan(0);

    // One character shorter: still matches every note, so the list stays long and the same row
    // stays on top — meaning cmdk's own selection never changes.
    await input.fill(COMMON_WORD.slice(0, -1));

    await expect(rows(page).first()).toHaveText(topRow ?? '');
    expect(await scrollTopOf(page)).toBe(0);
    await expect(rows(page).first()).toBeInViewport();
  });

  test('geleerte Eingabe zeigt die angepinnte Notiz oben, nicht die alte Relevanzordnung', async ({ page }) => {
    const input = await openPalette(page);
    await input.fill(TARGET_TITLE);
    await expect(rows(page).first()).toHaveText(new RegExp(TARGET_TITLE));

    // cmdk's DOM sort bails on an empty query, so the last relevance order used to stay
    // stranded in the DOM — the target stayed on top although it is the oldest note.
    await input.fill('');

    await expect(rows(page).first()).toHaveText(new RegExp(PINNED_TITLE));
    expect(await scrollTopOf(page)).toBe(0);
  });

  test('Tag-Modus über @ findet den Tag und rankt ihn oben', async ({ page }) => {
    const input = await openPalette(page);
    await input.fill('@alpha');

    await expect(rows(page).first()).toHaveText(new RegExp(TARGET_TAG.replace('/', '\\/')));
    expect(await scrollTopOf(page)).toBe(0);
  });
});
