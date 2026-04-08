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
  await expect(page.locator("#note-title")).toHaveValue("Unbenannt");
  await page.locator("#note-title").fill(title);
  const saved = waitForSave(page);
  await page.locator(".cm-content").click();
  await page.locator(".cm-content").pressSequentially(content);
  await saved;
  return page.url();
}

/** Go back online and ensure the app detects the change.
 *  Playwright's setOffline may not fire the 'online' event reliably,
 *  but useOnlineStatus depends on it to trigger the sync queue. */
export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  // Dispatch online event as safety net — ignore if page navigated (sync already fired)
  await page
    .evaluate(() => window.dispatchEvent(new Event("online")))
    .catch(() => {});
}

/** Extract note ID from a /notes/<id> URL. */
export function noteIdFromUrl(url: string): string {
  const match = /\/notes\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`No note ID in URL: ${url}`);
  return match[1];
}

/** Delete all notes via the API so tests start with a clean slate. */
export async function deleteAllNotes(page: Page): Promise<void> {
  const res = await page.request.get("/api/notes");
  const notes: { id: string }[] = await res.json();
  await Promise.all(
    notes.map((n) => page.request.delete(`/api/notes/${n.id}`)),
  );
}
