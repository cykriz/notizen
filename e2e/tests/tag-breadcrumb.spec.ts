import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  TAG_BREADCRUMB_TO_ROOT_LABEL,
  TAG_BREADCRUMB_UP_LABEL,
  TAG_FOLDER_DELETE_LABEL,
  TAG_ROOT_LABEL,
} from '../../lib/tagConstants';
import { createNote, createNoteWithTag, deleteAllNotes, watchForHydrationErrors } from './helpers';

// The leaf is the case this layout exists for: a two-word folder name that the old
// two-segment row cut down to "mentale ge…". The ancestors are deliberately long —
// with any of them still in the row, the leaf cannot survive intact, so the
// "not ellipsized" assertion below is what proves the prefix really is gone.
const DEEP_TAG = 'persönlich/gesundheit/lebensmittelunverträglichkeiten/mentale gesundheit';
const LEAF_SEGMENT = 'mentale gesundheit';
const ANCESTOR_SEGMENTS = ['persönlich', 'gesundheit', 'lebensmittelunverträglichkeiten'];
// Every row of the path menu, in the order it renders.
const PATH_MENU_NAMES = [TAG_ROOT_LABEL, ...ANCESTOR_SEGMENTS];
// One segment, so root is the only jump target: the back button's direct form. Shares no
// name with DEEP_TAG's segments, so no locator in this file can match across the two.
const FLAT_TAG = 'werkzeug';
// Minimum comfortable touch target; `.menu-row` carries the height for it.
const TOUCH_TARGET_PX = 44;
const PHONE_VIEWPORT = { width: 390, height: 844 };

/** The breadcrumb's current-folder label, found by the full path it carries as its title. */
function currentLabel(page: Page, path: string): Locator {
  return page.getByTitle(path, { exact: true });
}

/** A row of a `.menu-row` popover menu, by its visible text — or any button, by its
 *  accessible name, which is how the icon-only breadcrumb buttons are located here. */
function menuRow(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

/** The icon a button renders, found by the class lucide stamps with the icon's own name.
 *  The label alone cannot tell the back button's two forms apart from the user's side —
 *  the chevrons are what announce, before the click, whether a menu is coming. */
function icon(button: Locator, name: string): Locator {
  return button.locator(`svg.lucide-${name}`);
}

/** Laid-out height, ignoring the popover's zoom-in-95 open animation — a transformed
 *  measurement reads ~42px mid-flight and makes the assertion flaky. */
async function layoutHeight(row: Locator): Promise<number> {
  await expect(row).toBeVisible();
  return await row.evaluate((el: HTMLElement) => el.offsetHeight);
}

/** How far a row's content starts from the row's own left edge. Measured as a
 *  difference inside one row, so the popover's open transform scales it away. */
async function labelIndent(row: Locator): Promise<number> {
  await expect(row).toBeVisible();
  return await row.evaluate((el: HTMLElement) => {
    const icon = el.querySelector('svg');
    if (icon === null) {
      throw new Error('row has no icon to measure against');
    }

    return icon.getBoundingClientRect().left - el.getBoundingClientRect().left;
  });
}

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

  // Regression: the row used to show the last two segments and let flexbox split the
  // shortfall between them, so on a deep path BOTH were ellipsized — the current
  // folder included. Geometry and scrollWidth are the assertions: a text/visibility
  // check passes even while the label is cut off or painted over the delete button.
  test('a deeply nested path shows its current folder in full', async ({ page }) => {
    await createNoteWithTag(page, 'Tiefe Notiz', 'Inhalt.', DEEP_TAG);

    // The sidebar follows the note into its folder once the note gains its first tag.
    const label = currentLabel(page, DEEP_TAG);
    await expect(label).toHaveText(LEAF_SEGMENT, { timeout: 15_000 });

    // The prefix is collapsed into the menu, not merely clipped — and the menu is closed.
    for (const segment of ANCESTOR_SEGMENTS) {
      await expect(page.getByRole('button', { name: segment, exact: true })).toHaveCount(0);
    }

    // The point of the whole change: the label is not ellipsized.
    const overflow = await label.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const deleteFolder = page.getByRole('button', { name: TAG_FOLDER_DELETE_LABEL, exact: true });
    await expect(deleteFolder).toBeInViewport();
    const [labelBox, deleteBox] = await Promise.all([bounds(label), bounds(deleteFolder)]);
    // 1px of tolerance for subpixel layout rounding.
    expect(labelBox.right).toBeLessThanOrEqual(deleteBox.left + 1);
  });

  test('the path menu jumps straight to any ancestor', async ({ page }) => {
    await createNoteWithTag(page, 'Tiefe Notiz', 'Inhalt.', DEEP_TAG);
    await expect(currentLabel(page, DEEP_TAG)).toHaveText(LEAF_SEGMENT, { timeout: 15_000 });

    await menuRow(page, TAG_BREADCRUMB_UP_LABEL).click();

    // Root plus every ancestor, in path order — no walking up one level at a time.
    for (const name of PATH_MENU_NAMES) {
      await expect(menuRow(page, name)).toBeVisible();
    }

    // Each row starts further right than the one above it, which is the only cue in
    // the menu that these are nested folders rather than a flat list.
    const indents = [];
    for (const name of PATH_MENU_NAMES) {
      indents.push(await labelIndent(menuRow(page, name)));
    }
    for (let i = 1; i < indents.length; i++) {
      expect(indents[i]).toBeGreaterThan(indents[i - 1]);
    }

    await menuRow(page, 'gesundheit').click();
    await expect(currentLabel(page, 'persönlich/gesundheit')).toHaveText('gesundheit');
  });

  // A menu of one row is not a menu, it is a click in front of the click. Root being the
  // only target left is the whole condition, so this is the shallowest path there is.
  test('a top-level folder jumps to the root without a menu', async ({ page }) => {
    await createNoteWithTag(page, 'Flache Notiz', 'Inhalt.', FLAT_TAG);
    await expect(currentLabel(page, FLAT_TAG)).toHaveText(FLAT_TAG, { timeout: 15_000 });

    // The menu form does not exist at this depth, and the single chevron says as much
    // before anyone clicks.
    const back = menuRow(page, TAG_BREADCRUMB_TO_ROOT_LABEL);
    await expect(menuRow(page, TAG_BREADCRUMB_UP_LABEL)).toHaveCount(0);
    await expect(icon(back, 'chevron-left')).toBeVisible();

    await back.click();

    // Root is exactly the state without a breadcrumb — TagNavigation renders it only
    // below root. The folder row in the tag list is no usable proof of arrival: its
    // accessible name carries TagFolderIcon's sr-only "Ordner", while an exact match on
    // the bare tag name hits the tag chip in the open note instead.
    await expect(currentLabel(page, FLAT_TAG)).toHaveCount(0);
    await expect(back).toHaveCount(0);
    // Last on purpose: by now a popover would have rendered, so a count of 0 means none
    // was ever mounted — the click navigated rather than opening a one-row menu.
    await expect(menuRow(page, TAG_ROOT_LABEL)).toHaveCount(0);
  });

  // The switch-over along one path, rather than at a special case: two targets are still
  // a menu, and only the step below that turns the button into a plain jump.
  test('the back button drops its menu once only the root is left', async ({ page }) => {
    await createNoteWithTag(page, 'Tiefe Notiz', 'Inhalt.', DEEP_TAG);
    await expect(currentLabel(page, DEEP_TAG)).toHaveText(LEAF_SEGMENT, { timeout: 15_000 });

    const menuTrigger = menuRow(page, TAG_BREADCRUMB_UP_LABEL);
    await expect(icon(menuTrigger, 'chevrons-left')).toBeVisible();

    // Depth 4 -> 'persönlich/gesundheit': root plus one ancestor is a real choice, so the
    // menu stays. Nobody may implement this as `ancestors.length <= 1`.
    await menuTrigger.click();
    await menuRow(page, 'gesundheit').click();
    await expect(currentLabel(page, 'persönlich/gesundheit')).toHaveText('gesundheit');
    await expect(menuTrigger).toBeVisible();

    // -> 'persönlich': only root left above, so the button changes both role and icon.
    await menuTrigger.click();
    await menuRow(page, 'persönlich').click();
    await expect(currentLabel(page, 'persönlich')).toHaveText('persönlich');
    await expect(menuTrigger).toHaveCount(0);
    await expect(icon(menuRow(page, TAG_BREADCRUMB_TO_ROOT_LABEL), 'chevron-left')).toBeVisible();
  });

  // Each test creates its note at the desktop viewport first — below `md` the tag
  // input createNoteWithTag types into is `hidden` — so the phone size is set per
  // test rather than through `test.use`.
  test.describe('on a phone', () => {
    test('the path menu is reachable and finger-sized inside the sidebar sheet', async ({ page }) => {
      await createNoteWithTag(page, 'Tiefe Notiz', 'Inhalt.', DEEP_TAG);
      await expect(currentLabel(page, DEEP_TAG)).toHaveText(LEAF_SEGMENT, { timeout: 15_000 });

      await page.setViewportSize(PHONE_VIEWPORT);
      // The active bottom-nav tab toggles the sidebar sheet.
      await menuRow(page, 'Notizen').click();
      await expect(currentLabel(page, DEEP_TAG)).toBeVisible();

      await menuRow(page, TAG_BREADCRUMB_UP_LABEL).click();

      for (const name of PATH_MENU_NAMES) {
        expect(await layoutHeight(menuRow(page, name))).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
      }

      await menuRow(page, 'gesundheit').click();
      await expect(currentLabel(page, 'persönlich/gesundheit')).toHaveText('gesundheit');
      // Only the popover closed — the sheet stays open.
      await expect(menuRow(page, TAG_BREADCRUMB_UP_LABEL)).toBeVisible();
    });

    // Tag paths are free-form, so the menu has no natural length limit. Radix can only
    // flip or shift the popover, never scroll it — without a capped, scrollable content
    // box the deepest ancestors of a path like this drop off the screen for good.
    test('a very deep path keeps every ancestor reachable', async ({ page }) => {
      // Deep enough that the rows alone (24 × 44px + gaps) outgrow the 844px viewport —
      // verified by removing the cap, which drops the last row out of view. A shallower
      // path still fits and would let the missing cap pass unnoticed.
      const levels = Array.from({ length: 25 }, (_, i) => `ebene${String(i + 1)}`);
      await createNoteWithTag(page, 'Sehr tiefe Notiz', 'Inhalt.', levels.join('/'));
      await expect(currentLabel(page, levels.join('/'))).toBeVisible({ timeout: 15_000 });

      await page.setViewportSize(PHONE_VIEWPORT);
      await menuRow(page, 'Notizen').click();
      await menuRow(page, TAG_BREADCRUMB_UP_LABEL).click();

      // The direct parent is the last row, so it is the one a too-tall menu loses.
      const parent = menuRow(page, 'ebene24');
      await parent.scrollIntoViewIfNeeded();
      await expect(parent).toBeInViewport();
      await parent.click();
      await expect(currentLabel(page, levels.slice(0, 24).join('/'))).toHaveText('ebene24');
    });

    // Lives here because `.menu-row` was extracted for this breadcrumb's menu: the
    // height sits in the shared class, so covering only the path menu would leave
    // the other consumer free to drift back to a 36px row on touch. "Tags" is the
    // sharpest case — it is `md:hidden`, so it exists ONLY at this width.
    test('the other .menu-row menu is finger-sized too', async ({ page }) => {
      await createNote(page, 'Notiz', 'Inhalt.');
      await page.setViewportSize(PHONE_VIEWPORT);

      await menuRow(page, 'Weitere Aktionen').click();

      for (const name of ['Datei anhängen', 'Teilen', 'Tags']) {
        expect(await layoutHeight(menuRow(page, name))).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
      }
    });
  });
});
