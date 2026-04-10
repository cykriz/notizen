import { type Page, expect } from "@playwright/test";

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

/** Delete all notes via the API and clear localStorage so tests
 *  start with a completely clean slate (no stale cache/sync entries). */
export async function deleteAllNotes(page: Page): Promise<void> {
  const res = await page.request.get("/api/notes");
  const notes: { id: string }[] = await res.json();
  await Promise.all(
    notes.map((n) => page.request.delete(`/api/notes/${n.id}`)),
  );
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("notizen:")) {
        localStorage.removeItem(key);
      }
    }
  });
}
