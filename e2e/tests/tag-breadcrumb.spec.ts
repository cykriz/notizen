import { test, expect, type Locator } from '@playwright/test';
import { TAG_FOLDER_DELETE_LABEL, tagBreadcrumbJumpLabel } from '../../lib/tagConstants';
import { createNoteWithTag, deleteAllNotes, watchForHydrationErrors } from './helpers';

// Deliberately long leaf segments: after the prefix collapses, these two alone still
// exceed the 16rem sidebar, so the row only fits if the segment buttons can shrink and
// ellipsize. Shorten them and the test stops covering that half of the fix — verified
// by removing `shrinkable` from TagBreadcrumb, which short names do not catch.
const DEEP_TAG = 'persönlich/gesundheit/lebensmittelunverträglichkeiten/frühstücksrezepte';
const PARENT_SEGMENT = 'lebensmittelunverträglichkeiten';
const LEAF_SEGMENT = 'frühstücksrezepte';
const JUMP_LABEL = tagBreadcrumbJumpLabel('persönlich/gesundheit');

/** Horizontal extent of a rendered element, failing the test if it is not laid out. */
async function bounds(locator: Locator): Promise<{ left: number; right: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('element is not laid out');
  }

  return { left: box.x, right: box.x + box.width };
}

test.describe('Tag breadcrumb', () => {
  let hydrationErrors: string[];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto('/notes');
    // A clean tag tree: no other tags means no suggestion dropdown swallowing the
    // Enter that commits the tag, and each segment name is unique on the page.
    await deleteAllNotes(page);
    await page.reload();
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  // Regression: every breadcrumb segment sat in a shrinkable span but the Button
  // inside carried `shrink-0` from buttonVariants, so on a deep path the segments
  // painted over each other and over the delete button. Geometry is the assertion —
  // a text/visibility check passes even while the buttons overlap, and the row's
  // own scrollWidth stays within bounds because the wrapper spans do shrink.
  test('a deeply nested tag path keeps its segments and delete button apart', async ({
    page,
  }) => {
    await createNoteWithTag(page, 'Tiefe Notiz', 'Inhalt.', DEEP_TAG);

    // The sidebar follows the note into its folder once the note gains its first tag.
    await expect(page.getByRole('button', { name: JUMP_LABEL })).toBeVisible({ timeout: 15_000 });

    // The prefix is collapsed, not merely clipped.
    await expect(page.getByRole('button', { name: 'persönlich', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'gesundheit', exact: true })).toHaveCount(0);

    const parent = page.getByRole('button', { name: PARENT_SEGMENT, exact: true });
    const current = page.getByRole('button', { name: LEAF_SEGMENT, exact: true });
    const deleteFolder = page.getByRole('button', { name: TAG_FOLDER_DELETE_LABEL, exact: true });
    await expect(deleteFolder).toBeInViewport();

    const [parentBox, currentBox, deleteBox] = await Promise.all([
      bounds(parent),
      bounds(current),
      bounds(deleteFolder),
    ]);
    // 1px of tolerance for subpixel layout rounding.
    expect(parentBox.right).toBeLessThanOrEqual(currentBox.left + 1);
    expect(currentBox.right).toBeLessThanOrEqual(deleteBox.left + 1);
  });

  test('the ellipsis walks up to the deepest hidden ancestor', async ({ page }) => {
    await createNoteWithTag(page, 'Tiefe Notiz', 'Inhalt.', DEEP_TAG);

    await page.getByRole('button', { name: JUMP_LABEL }).click();

    // Depth 2 fits without eliding, so the whole path is visible and no ellipsis is left.
    await expect(page.getByRole('button', { name: 'persönlich', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'gesundheit', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Zu / })).toHaveCount(0);
  });
});
