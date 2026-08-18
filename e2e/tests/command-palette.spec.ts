import { test, expect, type Locator, type Page } from '@playwright/test';
import { PHONE_VIEWPORT, deleteAllNotes, watchForHydrationErrors } from './helpers';

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

// The dialog title of CommandPalette — a literal only that component has, so it identifies the
// lazily loaded chunk in a build where the file names are hashed.
const PALETTE_CHUNK_MARKER = 'Befehlspalette';

/** The scroll container cmdk renders — the element carrying max-h/overflow-y. */
function resultList(page: Page): Locator {
  return page.locator('[data-slot=command-list]');
}

function rows(page: Page): Locator {
  return page.locator('[cmdk-item]');
}

/** The palette's positioned box, or a hard failure — an absent box must not read as a
 *  passing position, which is what any `?? fallback` on `boundingBox()` would do. */
async function dialogBox(page: Page): Promise<{ y: number; height: number }> {
  const box = await page.locator('[data-slot=dialog-content]').boundingBox();
  if (box === null) {
    throw new Error('the palette dialog has no bounding box — it is not rendered');
  }

  return box;
}

/** The viewport, or a hard failure — same reason as `dialogBox` above. */
function viewportOf(page: Page): { height: number } {
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error('the page has no viewport size');
  }

  return viewport;
}

/** The bottom bar's search button: the only pointer-driven way into the palette. */
function searchButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Suchen', exact: true });
}

/** The sidebar in its mobile form. `/notes` opens it on mount (MobileSidebarOpener) and its
 *  overlay covers the bottom bar, so a mobile test has to dismiss it exactly as a user does. */
function mobileSidebar(page: Page): Locator {
  return page.locator('[data-slot=sidebar][data-mobile=true]');
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

/**
 * Waits until the layout's mount effects have run — a barrier, not a retry.
 *
 * `useVisualViewportHeight` sets `--app-h` inline on <html> from a mount effect, and
 * `ViewportEffects` sits in the same layout pass as `CommandPaletteClient`. React flushes a pass's
 * passive effects in one task, so seeing the style from the outside means every layout effect ran —
 * including the one that binds Mod+P. What it does NOT wait for is the palette's lazy chunk, which
 * is exactly the gap the shortcut has to survive.
 */
async function waitForAppHydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('style', /--app-h/);
}

/** One press, no retry: swallowing the first Mod+P is the bug, not a condition to work around. */
async function openPalette(page: Page): Promise<Locator> {
  const input = page.getByPlaceholder('Suchen…');
  await waitForAppHydrated(page);
  await page.keyboard.press('ControlOrMeta+p');
  await expect(input).toBeVisible();

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

  test('Mod+P schließt die offene Palette und verwirft die Suche', async ({ page }) => {
    const input = await openPalette(page);
    await input.fill(TARGET_TITLE);

    await page.keyboard.press('ControlOrMeta+p');
    await expect(input).toBeHidden();

    // The shortcut used to bypass the close handler, so only Escape and a selected row cleared the
    // query — reopening showed the old search, and after an `@` query even the wrong input mode.
    await page.keyboard.press('ControlOrMeta+p');
    await expect(input).toHaveValue('');
  });

  // The reported case is Ctrl+P, and it is the one key whose damage cannot be read back: it closes
  // the palette, so cmdk's selection move and the close land in the SAME React commit and the list
  // is gone a commit later. Ctrl+N goes through the identical cmdk branch (`case "n"` sits next to
  // `case "p"` in its vimBindings switch) and through the identical global listener — and on /todos
  // its owner opens a dialog instead of closing the palette, so the selection survives to be
  // asserted. Anything that puts the global listener back into the bubble phase fails here.
  test('ein Mod-Shortcut bei offener Palette bewegt die Auswahl nicht mehr', async ({ page }) => {
    await page.goto('/todos');
    const input = await openPalette(page);
    await input.fill(COMMON_WORD);

    // Without cmdk's `loop`, moving off row 1 first is what makes a stray move observable at all.
    await page.keyboard.press('ArrowDown');
    await expect(rows(page).nth(1)).toHaveAttribute('data-selected', 'true');

    // Control, not ControlOrMeta: cmdk's vimBindings check ctrlKey only, so Cmd+N never reached
    // them on macOS and the test would prove nothing there.
    await page.keyboard.press('Control+n');

    // The shortcut itself still has to work — the fix claims the key, it does not swallow it.
    await expect(page.getByRole('heading', { name: 'Neue Aufgabe' })).toBeVisible();
    await expect(rows(page).nth(1)).toHaveAttribute('data-selected', 'true');
  });

  test('der Such-Button der Bottom-Nav öffnet die Palette auf dem Handy', async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT);

    // Dismissed first, and awaited rather than blind-dismissed: the sheet opens from an effect that
    // runs after the resize, so an early Escape would be swallowed. While it is open the rest of the
    // page is `aria-hidden` (Radix modal), which puts the bar outside the a11y tree entirely.
    await expect(mobileSidebar(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mobileSidebar(page)).toBeHidden();

    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(nav).toBeVisible();

    await waitForAppHydrated(page);
    const input = page.getByPlaceholder('Suchen…');
    await searchButton(page).click();
    await expect(input).toBeVisible();

    // Top-anchored below `lg`: centred, the result list sat behind the on-screen keyboard.
    expect((await dialogBox(page)).y).toBeLessThan(100);

    await input.fill(TARGET_TITLE);
    await expect(rows(page).first()).toHaveText(new RegExp(TARGET_TITLE));

    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
    await expect(nav).toBeVisible();
  });

  // The other half of the same class: nothing about the mobile anchoring may reach the desktop.
  test('auf dem Desktop bleibt die Palette vertikal zentriert', async ({ page }) => {
    await openPalette(page);

    const box = await dialogBox(page);
    const offCentre = Math.abs(box.y + box.height / 2 - viewportOf(page).height / 2);
    expect(offCentre).toBeLessThan(40);
  });
});

// Own context, own describe, and no seeding on purpose: the route below has to be installed before
// the very first navigation of this browser context. Any earlier `goto` would put the palette chunk
// into the memory cache, where Chromium serves it without a network request Playwright could hold.
test.describe('Befehlspalette — erster Mod+P nach dem Seitenwechsel', () => {
  // Mandatory: the SW precaches every /_next/static/ asset including next/dynamic chunks
  // (worker/swPrecache.ts). A cached chunk arrives without a request, page.route would never fire,
  // and the negative control below would quietly pass against the very code it is meant to catch.
  test.use({ serviceWorkers: 'block' });

  interface ChunkGate {
    /** Resolves once the chunk request is parked in the handler — the state these tests need
     *  (chunk in flight, dialog not mounted). A barrier, never a retry of the interaction. */
    waitUntilHeld: () => Promise<void>;
    release: () => void;
  }

  /** Hold the palette's chunk back instead of racing it: from localhost it arrives in a few ms,
   *  so on a fast machine the window the bug lived in would be invisible. */
  async function holdPaletteChunk(page: Page): Promise<ChunkGate> {
    let release = (): void => undefined;
    let held = 0;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route(/_next\/static\/chunks\/.*\.js$/, async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      if (body.includes(PALETTE_CHUNK_MARKER)) {
        held++;
        await gate;
      }

      await route.fulfill({ response: res, body });
    });

    return {
      // The chunk is requested only after hydration (measured), so `waitForAppHydrated` does not
      // imply it. Without this check a missed interception would let a test pass quietly against
      // the very code it must catch.
      waitUntilHeld: async () => {
        await expect(() => {
          expect(held, 'palette chunk was never intercepted — the test would prove nothing').toBeGreaterThan(0);
        }).toPass({ timeout: 10_000 });
      },
      release: () => {
        release();
      },
    };
  }

  test('der Druck landet, während der Palette-Chunk noch unterwegs ist', async ({ page }) => {
    const chunk = await holdPaletteChunk(page);

    await page.goto('/notes');
    await waitForAppHydrated(page);
    await chunk.waitUntilHeld();

    await page.keyboard.press('ControlOrMeta+p');
    chunk.release();

    await expect(page.getByPlaceholder('Suchen…')).toBeVisible();
  });

  // Same guarantee for the tap, and it needs its own test: the button is a second owner of the
  // store, and it is the only entry point on a device that has no Mod key to retry with.
  test('der Tap auf den Such-Button landet ebenso', async ({ page }) => {
    await page.setViewportSize(PHONE_VIEWPORT);
    const chunk = await holdPaletteChunk(page);

    // /todos, not /notes: no sidebar sheet opens on mount there, so nothing covers the bottom bar.
    await page.goto('/todos');
    await waitForAppHydrated(page);
    await chunk.waitUntilHeld();

    await searchButton(page).click();
    chunk.release();

    await expect(page.getByPlaceholder('Suchen…')).toBeVisible();
  });
});
