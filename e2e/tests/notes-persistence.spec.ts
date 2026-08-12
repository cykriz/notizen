import { test, expect } from '@playwright/test';
import { waitForSave, deleteAllNotes } from './helpers';

test.describe('Notes Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await deleteAllNotes(page);
    await page.reload();
  });

  test('created notes with content persist after reload', async ({ page }) => {
    const titleInput = page.locator('#note-title');
    const editor = page.locator('.cm-content');

    // --- Create first note with a checklist ---
    await page.getByRole('button', { name: /Neue Notiz/ }).click();
    await expect(titleInput).toHaveValue('Unbenannt');

    await titleInput.fill('Einkaufsliste');
    const save1 = waitForSave(page);
    await editor.click();
    await editor.pressSequentially(
      '# Einkaufen\n\n- [ ] Milch\n- [ ] Brot\n- [x] Butter\n\nFertig.',
    );
    await save1;

    // --- Create second note ---
    const firstUrl = page.url();
    await page.getByRole('button', { name: /Neue Notiz/ }).click();
    await expect(page).not.toHaveURL(firstUrl, { timeout: 10_000 });
    await expect(titleInput).toHaveValue('Unbenannt');

    await titleInput.fill('Projektnotizen');
    const save2 = waitForSave(page);
    await editor.click();
    await editor.pressSequentially('## Status\n\nAlles läuft nach Plan.');
    await save2;

    // --- Reload and verify both notes appear in sidebar ---
    await page.reload();
    await expect(page.getByText('Einkaufsliste')).toBeVisible();
    await expect(page.getByText('Projektnotizen')).toBeVisible();

    // --- Verify first note content (opens in preview mode) ---
    await page.getByText('Einkaufsliste').click();
    await expect(titleInput).toHaveValue('Einkaufsliste');
    // Content is rendered as preview markdown
    await expect(page.locator('.wmde-markdown')).toContainText('Milch');
    await expect(page.locator('.wmde-markdown')).toContainText('Brot');
    await expect(page.locator('.wmde-markdown')).toContainText('Butter');
    await expect(page.locator('.wmde-markdown')).toContainText('Fertig.');

    // --- Verify second note content ---
    await page.getByText('Projektnotizen').click();
    await expect(titleInput).toHaveValue('Projektnotizen');
    await expect(page.locator('.wmde-markdown')).toContainText(
      'Alles läuft nach Plan.',
    );
  });

  test('editing an existing note persists changes after reload', async ({
    page,
  }) => {
    const titleInput = page.locator('#note-title');
    const editor = page.locator('.cm-content');

    // Create a note
    await page.getByRole('button', { name: /Neue Notiz/ }).click();
    await expect(titleInput).toHaveValue('Unbenannt');

    await titleInput.fill('Änderungstest');
    const saveInitial = waitForSave(page);
    await editor.click();
    await editor.pressSequentially('Erster Inhalt.');
    await saveInitial;

    // Modify the content (still in edit mode from creation)
    const saveEdit = waitForSave(page);
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Geänderter Inhalt.\n\n- [ ] Neue Aufgabe');
    await saveEdit;

    // Reload and verify
    await page.reload();
    await page.getByRole('link', { name: 'Änderungstest' }).click();
    await expect(titleInput).toHaveValue('Änderungstest');
    await expect(page.locator('.wmde-markdown')).toContainText(
      'Geänderter Inhalt.',
    );
    await expect(page.locator('.wmde-markdown')).toContainText('Neue Aufgabe');
  });

  test('unsaved edits survive navigation via draft', async ({ page }) => {
    const titleInput = page.locator('#note-title');
    const editor = page.locator('.cm-content');

    // Create a note and wait for it to sync to the server
    await page.getByRole('button', { name: /Neue Notiz/ }).click();
    await expect(titleInput).toHaveValue('Unbenannt');
    await titleInput.fill('Entwurf-Test');
    const saveDraft = waitForSave(page);
    await editor.click();
    await editor.pressSequentially('Gespeicherter Inhalt.');
    await saveDraft;

    // Type new content — draft is written to localStorage on each keystroke
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Ungespeicherter Entwurf!');

    // Verify draft exists in localStorage (draft writes after 300ms debounce)
    const noteId = /\/notes\/([^/?#]+)/.exec(page.url())?.[1] ?? '';
    await expect(async () => {
      const draftContent = await page.evaluate(
        (id) => {
          const raw = localStorage.getItem(`notizen:draft:${id}`);
          if (raw === null) {
            return null;
          }

          return (JSON.parse(raw) as { content: string }).content;
        },
        noteId,
      );
      expect(draftContent).toContain('Ungespeicherter Entwurf!');
    }).toPass({ timeout: 2_000 });

    // Navigate away immediately (before auto-save fires) and reload —
    // this destroys React state, simulating what happens when the server dies
    await page.goto('/notes');
    await page.reload();

    // Navigate back to the note
    await page.getByRole('link', { name: 'Entwurf-Test' }).click();

    // Verify draft content was restored (note opens in preview mode)
    // navigation + server component render can be slow under test load
    await expect(page.locator('.wmde-markdown')).toContainText(
      'Ungespeicherter Entwurf!',
      { timeout: 15_000 },
    );
  });
});
