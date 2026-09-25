import { test, expect, type Page } from '@playwright/test';
import { PINNED_LABEL } from '../../lib/constants';
import { NOTES_EMPTY_STATE, deleteAllNotes, watchForHydrationErrors } from './helpers';
import { boxOf } from './geometry';

async function apiCreateNote(page: Page, title: string, pinned: boolean): Promise<string> {
  const res = await page.request.post('/api/notes', { data: { title, content: 'Inhalt', tags: [] } });
  expect(res.ok(), `POST /api/notes failed for ${title}`).toBe(true);
  const { id } = (await res.json()) as { id: string };
  if (pinned) {
    const put = await page.request.put(`/api/notes/${id}`, { data: { pinned: true } });
    expect(put.ok(), `PUT pinned failed for ${title}`).toBe(true);
  }

  return id;
}

/** The overview section — scoped so the sidebar's own pinned group never matches. */
function overview(page: Page) {
  return page.getByRole('region', { name: PINNED_LABEL });
}

test.describe('Pinned notes on the /notes empty state', () => {
  let hydrationErrors: string[];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto('/notes');
    await deleteAllNotes(page);
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  test('no pins: plain empty state without the overview', async ({ page }) => {
    await apiCreateNote(page, 'Nicht angepinnt', false);
    await page.goto('/notes');
    await expect(page.getByText(NOTES_EMPTY_STATE)).toBeVisible();
    await expect(overview(page)).toHaveCount(0);
  });

  test('lists only pinned notes, side by side, and opens one on click', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const idA = await apiCreateNote(page, 'Pin Alpha', true);
    await apiCreateNote(page, 'Pin Beta', true);
    await apiCreateNote(page, 'Lose Gamma', false);
    await page.goto('/notes');

    const tiles = overview(page).getByTestId('pinned-tile');
    await expect(tiles).toHaveCount(2);
    await expect(overview(page).getByText('Lose Gamma')).toHaveCount(0);

    const [first, second] = [await boxOf(tiles.nth(0)), await boxOf(tiles.nth(1))];
    expect(first.y).toBe(second.y);
    expect(second.x).toBeGreaterThan(first.x + first.width - 1);

    await overview(page).getByRole('link', { name: /Pin Alpha/ }).click();
    await page.waitForURL(`/notes/${idA}`);
  });

  test('many pins scroll without pushing the empty-state header out of reach', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    for (let i = 0; i < 18; i++) {
      await apiCreateNote(page, `Pin ${i.toString()}`, true);
    }
    await page.goto('/notes');
    await expect(overview(page).getByTestId('pinned-tile')).toHaveCount(18);

    // Icon + text wrapper, not the text: the icon above it is what overflow clips first.
    const header = page.getByText(NOTES_EMPTY_STATE).locator('..');
    const scroller = header.locator('..');
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    expect((await boxOf(header)).y).toBeGreaterThanOrEqual((await boxOf(scroller)).y);
  });
});
