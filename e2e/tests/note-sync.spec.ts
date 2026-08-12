import { test, expect } from '@playwright/test';
import { createNote, deleteAllNotes, goOffline, goOnline, noteIdFromUrl } from './helpers';

test.describe('Note Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await deleteAllNotes(page);
    await page.reload();
  });

  test('server-side deletion is respected on reload', async ({ page }) => {
    const url = await createNote(page, 'Zum Löschen', 'Inhalt hier.');
    const noteId = noteIdFromUrl(url);

    // Reload to confirm it exists
    await page.reload();
    await expect(
      page.getByRole('link', { name: 'Zum Löschen' }),
    ).toBeVisible();

    // Delete via API (simulates deletion from another device)
    const delRes = await page.request.delete(`/api/notes/${noteId}`);
    expect(delRes.ok()).toBe(true);

    // Navigate to /notes — note must NOT be resurrected from cache
    await page.goto('/notes');
    await expect(
      page.getByRole('link', { name: 'Zum Löschen' }),
    ).not.toBeVisible();
  });

  test('offline-created note survives reload before sync', async ({
    page,
  }) => {
    await goOffline(page);

    // Click "Neue Notiz" — the note is created in localStorage and
    // appears in the sidebar, but page navigation doesn't work offline
    await page.getByRole('button', { name: /Neue Notiz/ }).click();

    // The note appears in the sidebar with default title
    await expect(
      page.getByRole('link', { name: 'Unbenannt' }),
    ).toBeVisible({ timeout: 5_000 });

    // Verify note exists in localStorage
    const cachedTitle = await page.evaluate(() => {
      const raw = localStorage.getItem('notizen:notes-list');
      if (raw === null) {
        return null;
      }

      const list = JSON.parse(raw) as { title: string }[];
      return list.find((n) => n.title === 'Unbenannt')?.title ?? null;
    });
    expect(cachedTitle).toBe('Unbenannt');

    // Go online and poll server until the note has been synced
    await goOnline(page);
    await expect(async () => {
      const res = await page.request.get('/api/notes');
      const notes = (await res.json()) as { title: string }[];
      expect(notes.some((n) => n.title === 'Unbenannt')).toBe(true);
    }).toPass({ timeout: 20_000 });

    // Reload and verify the note persists (now server-backed)
    await page.reload();
    await expect(
      page.getByRole('link', { name: 'Unbenannt' }),
    ).toBeVisible();
  });

  test('editing a note offline persists and syncs', async ({ page }) => {
    const noteUrl = await createNote(page, 'Bearbeitbar', 'Originaler Inhalt.');
    const noteId = noteIdFromUrl(noteUrl);

    // Go offline and edit
    await goOffline(page);
    const editor = page.locator('.cm-content');

    // Ensure edit mode and replace content
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Bearbeiteter Inhalt offline.');

    // Wait for the draft/cache write to settle
    await expect(async () => {
      const found = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key !== null && (key.startsWith('notizen:note:') || key.startsWith('notizen:draft:'))) {
            const raw = localStorage.getItem(key);
            if (raw?.includes('Bearbeiteter Inhalt offline') === true) {
              return true;
            }
          }
        }
        return false;
      });
      expect(found).toBe(true);
    }).toPass({ timeout: 5_000 });

    // Verify edit is in localStorage (auto-save writes after 1s debounce)
    await expect(async () => {
      const cachedContent = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('notizen:note:') === true) {
            const raw = localStorage.getItem(key);
            if (raw === null) {
              continue;
            }

            const note = JSON.parse(raw) as { content: string };
            if (note.content.includes('Bearbeiteter Inhalt offline')) {
              return note.content;
            }
          }
        }
        return null;
      });
      expect(cachedContent).toContain('Bearbeiteter Inhalt offline');
    }).toPass({ timeout: 5_000 });

    // Go online and poll server until the edit has been synced
    await goOnline(page);
    await expect(async () => {
      const res = await page.request.get(`/api/notes/${noteId}`);
      const note = (await res.json()) as { content: string };
      expect(note.content).toContain('Bearbeiteter Inhalt offline');
    }).toPass({ timeout: 20_000 });

    // Reload and verify edits survived
    await page.reload();
    await page.getByRole('link', { name: 'Bearbeitbar' }).click();
    await expect(page.locator('.wmde-markdown')).toContainText(
      'Bearbeiteter Inhalt offline.',
    );
  });

  test('deleting a note offline syncs on reconnect', async ({ page }) => {
    const url = await createNote(page, 'Bald weg', 'Wird gelöscht.');
    const noteId = noteIdFromUrl(url);

    // Navigate to notes list so the sidebar item is visible
    await page.goto('/notes');
    await expect(
      page.getByRole('link', { name: 'Bald weg' }),
    ).toBeVisible();

    // Go offline and delete via UI
    await goOffline(page);

    const noteLink = page.getByRole('link', { name: 'Bald weg' });
    const noteItem = page.locator('li', { has: noteLink });
    await noteLink.hover();
    await noteItem
      .getByRole('button', { name: 'Notiz löschen' })
      .click();
    await page
      .getByRole('button', { name: 'In den Papierkorb' })
      .click();

    await expect(noteLink).not.toBeVisible({ timeout: 5_000 });

    // Go online and navigate to a fresh page to trigger sync
    await goOnline(page);
    await page.goto('/notes');

    // Poll server until the DELETE has been synced (avoids flaky waitForResponse)
    await expect(async () => {
      const res = await page.request.get(`/api/notes/${noteId}`);
      expect(res.status()).toBe(404);
    }).toPass({ timeout: 20_000 });

    // Confirm gone from sidebar
    await page.reload();
    await expect(
      page.getByRole('link', { name: 'Bald weg' }),
    ).not.toBeVisible();
  });
});
