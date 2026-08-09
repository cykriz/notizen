import { type Locator, type Page, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { TEST_NOTES_ROOT } from "../playwright.config";
import { SHARES_DIR, SHARES_FILE } from "../../lib/constants";
import { FAILED_SYNC_DIALOG_TITLE, FAILED_SYNC_OPEN_LABEL } from "../../lib/failedSyncConstants";
import type { ShareEntry } from "../../lib/fsSharesRegistry";
import { clearLocalState, readPendingQueue } from "./storageHelpers";

/** Wait for the auto-save PUT to /api/notes/ to complete successfully. */
export async function waitForSave(page: Page): Promise<void> {
  await page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/notes/") &&
      resp.request().method() === "PUT" &&
      resp.ok(),
    { timeout: 10_000 },
  );
}

/** Create a note, wait for save, return the URL. */
export async function createNote(
  page: Page,
  title: string,
  content: string,
): Promise<string> {
  await page.getByRole("button", { name: /Neue Notiz/ }).click();
  await page.waitForURL(/\/notes\/[^/]+$/, { timeout: 30_000 });
  await expect(page.locator("#note-title")).toHaveValue("Unbenannt", { timeout: 10_000 });
  await page.locator("#note-title").fill(title);
  const saved = waitForSave(page);
  await page.locator(".cm-content").click();
  await page.locator(".cm-content").pressSequentially(content);
  await saved;
  return page.url();
}

/** Go back online and wait for the app to detect it.
 *  Tries to wait for the health check so `isOnline` flips to true,
 *  but does not fail if the check is slow — the caller's own response
 *  waiter (for the actual PUT/DELETE/POST) is the real gate. */
export async function goOnline(page: Page): Promise<void> {
  const healthOk = page
    .waitForResponse(
      (resp) => resp.url().includes("/api/health") && resp.ok(),
      { timeout: 15_000 },
    )
    .catch(() => {});
  await page.context().setOffline(false);
  await page
    .evaluate(() => window.dispatchEvent(new Event("online")))
    .catch(() => {});
  await healthOk;
}

/** Go offline safely: waits for all pending network requests (lazy chunks,
 *  RSC payloads) to finish before cutting the connection. Without this,
 *  Next.js throws RuntimeChunkLoadError when an in-flight chunk fetch fails. */
export async function goOffline(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.context().setOffline(true);
}

/** Extract note ID from a /notes/<id> URL. */
export function noteIdFromUrl(url: string): string {
  const match = /\/notes\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`No note ID in URL: ${url}`);
  return match[1];
}

const SHARES_FILE_PATH = path.join(TEST_NOTES_ROOT, SHARES_DIR, SHARES_FILE);

/** Wipe the central share registry. Use in beforeEach to prevent cross-test leakage. */
export async function deleteAllShares(): Promise<void> {
  await fs.rm(SHARES_FILE_PATH, { force: true });
}

/** Read the raw share registry. Returns empty object if missing. */
export async function readShareRegistry(): Promise<Record<string, ShareEntry>> {
  try {
    const raw = await fs.readFile(SHARES_FILE_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, ShareEntry>;
  } catch {
    return {};
  }
}

/** Overwrite a single share's expiresAt. Used to force expiry without time-travel. */
export async function setShareExpiry(token: string, expiresAt: string): Promise<void> {
  const registry = await readShareRegistry();
  const entry = registry[token];
  if (!entry) {
    throw new Error(`Share token not found in registry: ${token}`);
  }
  registry[token] = { ...entry, expiresAt };
  await fs.mkdir(path.dirname(SHARES_FILE_PATH), { recursive: true });
  await fs.writeFile(SHARES_FILE_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

/** Wait for a queued mutation to appear (auto-save is debounced). */
export async function waitForPendingEntry(page: Page): Promise<void> {
  await expect(async () => {
    expect((await readPendingQueue(page)).length).toBeGreaterThan(0);
  }).toPass({ timeout: 5_000 });
}

/** Click the failed-sync indicator and wait for the inspector to open. */
export async function openFailedSyncDialog(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: FAILED_SYNC_OPEN_LABEL })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(FAILED_SYNC_DIALOG_TITLE)).toBeVisible({ timeout: 5_000 });
  return dialog;
}

/** Delete all todos via the API and clear localStorage. Without this the matrix
 *  keeps rows from earlier tests, and a `.first()` locator silently targets the
 *  wrong card. */
export async function deleteAllTodos(page: Page): Promise<void> {
  const res = await page.request.get("/api/todos");
  const todos: { id: string }[] = await res.json();
  await Promise.all(todos.map((t) => page.request.delete(`/api/todos/${t.id}`)));
  await clearLocalState(page);
}

/** Delete all notes via the API and clear localStorage so tests
 *  start with a completely clean slate (no stale cache/sync entries). */
export async function deleteAllNotes(page: Page): Promise<void> {
  const res = await page.request.get("/api/notes");
  const notes: { id: string }[] = await res.json();
  await Promise.all(
    notes.map((n) => page.request.delete(`/api/notes/${n.id}`)),
  );
  await clearLocalState(page);
}
