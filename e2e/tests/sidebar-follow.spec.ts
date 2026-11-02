import { test, expect, type Locator, type Page } from '@playwright/test';
import { createNoteWithTag, deleteAllNotes, waitForSave, watchForHydrationErrors } from './helpers';
import { currentLabel } from './tagLocators';

// A parent folder and one of its children: the case the old sync got wrong. Standing in the
// parent counted as "still on the note's path", yet the sidebar only lists notes whose tags
// contain the folder exactly — so the open note silently left the list.
const PARENT = 'arbeit';
const CHILD = 'arbeit/kunden';

/** The highlighted row in the sidebar's note list — the one for the open note. Narrowed to
 *  note links: the "Notizen" tab in the sidebar header is an active menu button too. */
function activeRow(page: Page): Locator {
  return page.locator('[data-sidebar="menu-button"][data-active="true"][href^="/notes/"]');
}

test.describe('Sidebar follows the open note', () => {
  let hydrationErrors: string[];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto('/notes');
    await deleteAllNotes(page);
    await page.reload();
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  test('moving the note into a subfolder via the header follows it there', async ({ page }) => {
    await createNoteWithTag(page, 'Umzug', 'Inhalt.', PARENT);
    await expect(currentLabel(page, PARENT)).toBeVisible({ timeout: 15_000 });

    // Rename the chip in place — one atomic tag change, no intermediate untagged state.
    const saved = waitForSave(page);
    await page.locator('main').getByRole('button', { name: PARENT, exact: true }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(CHILD);
    await page.keyboard.press('Enter');
    await saved;

    await expect(currentLabel(page, CHILD)).toBeVisible();
    await expect(activeRow(page)).toContainText('Umzug');
  });

  test('following an internal link opens the target note’s folder', async ({ page }) => {
    await createNoteWithTag(page, 'Ziel', 'Hier landet der Link.', CHILD);
    const targetPath = new URL(page.url()).pathname;

    // Back to the root first — "Neue Notiz" creates into the open folder, which would give
    // the source note the child tag as well.
    await page.goto('/notes');
    await createNoteWithTag(page, 'Quelle', `[Zum Ziel](${targetPath})`, PARENT);
    await expect(currentLabel(page, PARENT)).toBeVisible({ timeout: 15_000 });

    // A reload opens the note in the preview, where the link is clickable.
    await page.reload();
    await page.locator('.wmde-markdown').getByRole('link', { name: 'Zum Ziel' }).click();
    await page.waitForURL(`**${targetPath}`);

    await expect(currentLabel(page, CHILD)).toBeVisible();
    await expect(activeRow(page)).toContainText('Ziel');
  });

  test('creating a note inside a folder keeps the sidebar in that folder', async ({ page }) => {
    await createNoteWithTag(page, 'Erste', 'Inhalt.', CHILD);
    await expect(currentLabel(page, CHILD)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Neue Notiz/ }).click();
    await page.waitForURL(/\/notes\/[^/]+$/);
    await expect(page.locator('#note-title')).toHaveValue('Unbenannt', { timeout: 10_000 });

    await expect(currentLabel(page, CHILD)).toBeVisible();
    await expect(activeRow(page)).toContainText('Unbenannt');
  });
});
