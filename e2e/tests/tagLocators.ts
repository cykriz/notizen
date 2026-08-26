import type { Locator, Page } from '@playwright/test';

/**
 * The breadcrumb's current-folder label, found by the full path it carries as its title.
 *
 * Shared rather than copied per spec: the breadcrumb row shows only the leaf segment
 * (`TagBreadcrumb.tsx`), so the full path in `title` is the only place the whole path is
 * readable — every tag spec needs the same locator, and two copies would drift.
 *
 * Unambiguous on purpose: TagNavigation's folder rows and the note page's TagBadge carry no
 * `title`, so an exact title match cannot hit anything but the breadcrumb. Locating those rows
 * by their visible name instead would — a folder row's accessible name includes TagFolderIcon's
 * sr-only "Ordner", and the bare tag name hits the chip in the open note.
 */
export function currentLabel(page: Page, path: string): Locator {
  return page.getByTitle(path, { exact: true });
}
