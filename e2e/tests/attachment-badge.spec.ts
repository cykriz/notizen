import { test, expect, type Page } from '@playwright/test';
import { createNote, deleteAllNotes, noteIdFromUrl, watchForHydrationErrors } from './helpers';
import { readCachedNotes } from './storageHelpers';

const NOTE_TITLE = 'Notiz mit Anhang';

// The badge is hidden while the row is hovered (md:group-hover/menu-item:hidden),
// so the test must never leave the mouse over the sidebar item.
function badgeFor(page: Page, title: string) {
  return page
    .locator('[data-slot="sidebar-menu-item"]')
    .filter({ has: page.getByRole('link', { name: title }) })
    .locator('[data-slot="sidebar-menu-badge"]');
}

test.describe('Attachment badge', () => {
  let hydrationErrors: string[];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto('/notes');
    await deleteAllNotes(page);
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  // Regression: deleting an attachment only updated the editor's own state, so the
  // sidebar count stayed put. It LOOKED fixed whenever the body changed too, because
  // removing the markdown link triggers autosave and the PUT response carries the
  // server's freshly counted value. This test kills that crutch: the attachment is
  // uploaded through the API, so no link is ever in the body, `removeAttachmentLink`
  // finds nothing on delete, and no PUT happens — hence no waitForSave anywhere.
  test('deleting an attachment updates the badge without a note save', async ({ page }) => {
    await createNote(page, NOTE_TITLE, 'Inhalt ohne Anhang-Link.');
    const noteId = noteIdFromUrl(page.url());

    const uploadRes = await page.request.post(`/api/notes/${noteId}/attachments`, {
      // Non-image is required: NoteEditor renders AttachmentList from
      // nonImageAttachments only, so an image would have no delete button.
      multipart: {
        file: { name: 'hinweis.txt', mimeType: 'text/plain', buffer: Buffer.from('Hinweis') },
      },
    });
    expect(uploadRes.ok()).toBe(true);

    // The server recounts the attachments dir on every read, so this also proves
    // the baseline the optimistic delta has to move away from.
    await page.reload();
    await expect(badgeFor(page, NOTE_TITLE)).toHaveText('1', { timeout: 15_000 });

    await page.getByRole('button', { name: 'Anhang löschen' }).click();

    // The list unmounts with its last non-image attachment — that the row is gone
    // is what says the DELETE landed rather than erroring out silently.
    await expect(page.getByRole('button', { name: 'Anhang löschen' })).toHaveCount(0);
    await expect(badgeFor(page, NOTE_TITLE)).toHaveCount(0, { timeout: 10_000 });

    // The localStorage list must follow too: adoptServerNote rebuilds the list from
    // the cache, so a count living only in React state would be reverted by the
    // next unrelated note mutation.
    await expect
      .poll(async () => {
        const rows = await readCachedNotes(page);
        return rows.find((r) => r.id === noteId)?.attachmentCount;
      }, { timeout: 10_000 })
      .toBe(0);
  });
});
