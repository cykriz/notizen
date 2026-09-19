import { test, expect, type Page } from '@playwright/test';
import { createNote, deleteAllNotes, deleteAllTodos, noteIdFromUrl } from './helpers';
import { QUADRANT } from '../../lib/constants';
import { DRAFT_PREFIX } from '../../lib/localCache';
import {
  SYNC_DONE_TITLE,
  SYNC_ERROR_TITLE,
  SYNC_IDLE_LABEL,
} from '../../lib/syncStatusConstants';

/**
 * The resting state of the sync indicator — the plain cloud, empty outbox.
 *
 * It had no coverage at all: every existing assertion targets the pending or the
 * failed branch, so the pull half of the button was unverified, and with it the
 * fact that it never fetched note BODIES and never reported a failed pull.
 *
 * "Another device" is simulated through page.request, which talks to the server
 * directly and leaves this tab's React state and localStorage untouched — exactly
 * the situation the button exists for.
 */

function syncButton(page: Page) {
  return page.getByRole('button', { name: SYNC_IDLE_LABEL });
}

/** The draft is cleared when auto-save reports success; a leftover would (rightly)
 *  make the pull skip the note, so wait for it instead of racing it. */
async function waitForDraftCleared(page: Page, noteId: string): Promise<void> {
  await expect(async () => {
    const draft = await page.evaluate(
      (key) => localStorage.getItem(key),
      `${DRAFT_PREFIX}${noteId}`,
    );
    expect(draft).toBeNull();
  }).toPass({ timeout: 10_000 });
}

async function createTodo(page: Page, title: string): Promise<string> {
  const res = await page.request.post('/api/todos', {
    data: { title, quadrant: QUADRANT.INBOX },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

test.describe('Manual sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await deleteAllNotes(page);
    await deleteAllTodos(page);
    await page.reload();
  });

  test('pulls a note changed on another device into the open editor', async ({ page }) => {
    const noteId = noteIdFromUrl(await createNote(page, 'Ursprungstitel', 'Ursprünglicher Text.'));
    await waitForDraftCleared(page, noteId);

    const res = await page.request.put(`/api/notes/${noteId}`, {
      data: { title: 'Fremd geändert', content: 'Text vom anderen Gerät.' },
    });
    expect(res.ok()).toBe(true);

    // Nothing has moved yet: the list pull carries no content, and no reload happened.
    await expect(page.locator('#note-title')).toHaveValue('Ursprungstitel');

    await syncButton(page).click();

    await expect(page.getByRole('link', { name: 'Fremd geändert' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#note-title')).toHaveValue('Fremd geändert');
    await expect(page.getByText('Text vom anderen Gerät.')).toBeVisible();
  });

  test('pulls a todo changed on another device into the board', async ({ page }) => {
    const todoId = await createTodo(page, 'Ursprungsaufgabe');
    await page.goto('/todos');
    await expect(page.getByText('Ursprungsaufgabe')).toBeVisible({ timeout: 10_000 });

    const res = await page.request.put(`/api/todos/${todoId}`, {
      data: { title: 'Aufgabe fremd geändert' },
    });
    expect(res.ok()).toBe(true);

    await syncButton(page).click();

    await expect(page.getByText('Aufgabe fremd geändert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ursprungsaufgabe')).toHaveCount(0);
  });

  test('confirms a sync that landed', async ({ page }) => {
    await createNote(page, 'Bestätigung', 'Inhalt.');

    await syncButton(page).click();

    await expect(syncButton(page)).toHaveAttribute('title', SYNC_DONE_TITLE, { timeout: 10_000 });
  });

  // The negative control for the three tests above: without it a pull that fetches
  // nothing is indistinguishable from one that worked, which is the whole complaint.
  //
  // The health probe, not /api/notes: the service worker answers every GET under
  // /api/ itself, and its own fetch is invisible to page.route — a stubbed GET
  // simply never happens. /api/health is a POST, which the SW passes through
  // untouched (worker/sw.ts), so this is the one gate a test can actually close.
  // It is also the first of the silent early returns the pull used to have.
  test('reports a pull the server refused', async ({ page }) => {
    await createNote(page, 'Fehlerfall', 'Inhalt.');

    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await syncButton(page).click();

    await expect(syncButton(page)).toHaveAttribute('title', SYNC_ERROR_TITLE, { timeout: 10_000 });
  });
});
