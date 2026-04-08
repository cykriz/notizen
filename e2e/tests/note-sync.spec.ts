import { test, expect } from "@playwright/test";
import { createNote, deleteAllNotes, goOnline, noteIdFromUrl } from "./helpers";

test.describe("Note Sync", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notes");
    await deleteAllNotes(page);
    await page.reload();
  });

  test("server-side deletion is respected on reload", async ({ page }) => {
    const url = await createNote(page, "Zum Löschen", "Inhalt hier.");
    const noteId = noteIdFromUrl(url);

    // Reload to confirm it exists
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Zum Löschen" }),
    ).toBeVisible();

    // Delete via API (simulates deletion from another device)
    const delRes = await page.request.delete(`/api/notes/${noteId}`);
    expect(delRes.ok()).toBe(true);

    // Navigate to /notes — note must NOT be resurrected from cache
    await page.goto("/notes");
    await expect(
      page.getByRole("link", { name: "Zum Löschen" }),
    ).not.toBeVisible();
  });

  test("offline-created note survives reload before sync", async ({
    page,
  }) => {
    // Ensure the app is fully loaded (all lazy chunks) before going offline
    await expect(
      page.getByRole("button", { name: /Neue Notiz/ }),
    ).toBeVisible();

    // Go offline
    await page.context().setOffline(true);

    // Click "Neue Notiz" — the note is created in localStorage and
    // appears in the sidebar, but page navigation doesn't work offline
    await page.getByRole("button", { name: /Neue Notiz/ }).click();

    // The note appears in the sidebar with default title
    await expect(
      page.getByRole("link", { name: "Unbenannt" }),
    ).toBeVisible({ timeout: 5_000 });

    // Verify note exists in localStorage
    const cachedTitle = await page.evaluate(() => {
      const raw = localStorage.getItem("notizen:notes-list");
      if (!raw) return null;
      const list = JSON.parse(raw) as { title: string }[];
      return list.find((n) => n.title === "Unbenannt")?.title ?? null;
    });
    expect(cachedTitle).toBe("Unbenannt");

    // Register response waiter before going online (sync fires immediately)
    const syncResponse = page.waitForResponse(
      (resp) => resp.url().includes("/api/notes") && resp.ok(),
      { timeout: 15_000 },
    );
    await goOnline(page);
    await syncResponse;

    // Reload and verify the note persists (now server-backed)
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Unbenannt" }),
    ).toBeVisible();
  });

  test("editing a note offline persists and syncs", async ({ page }) => {
    await createNote(page, "Bearbeitbar", "Originaler Inhalt.");

    // Go offline and edit
    await page.context().setOffline(true);
    const editor = page.locator(".cm-content");

    // Ensure edit mode and replace content
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Bearbeiteter Inhalt offline.");

    // Wait for the draft/cache write to settle
    await expect(async () => {
      const found = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("notizen:note:") || key?.startsWith("notizen:draft:")) {
            const raw = localStorage.getItem(key);
            if (raw?.includes("Bearbeiteter Inhalt offline")) return true;
          }
        }
        return false;
      });
      expect(found).toBe(true);
    }).toPass({ timeout: 5_000 });

    // Verify edit is in localStorage
    const cachedContent = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("notizen:note:")) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const note = JSON.parse(raw) as { content: string };
          if (note.content.includes("Bearbeiteter Inhalt offline")) {
            return note.content;
          }
        }
      }
      return null;
    });
    expect(cachedContent).toContain("Bearbeiteter Inhalt offline");

    // Register response waiter before going online (sync fires immediately)
    const putResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/notes/") &&
        resp.request().method() === "PUT" &&
        resp.ok(),
      { timeout: 15_000 },
    );
    await goOnline(page);
    await putResponse;

    // Reload and verify edits survived
    await page.reload();
    await page.getByRole("link", { name: "Bearbeitbar" }).click();
    await expect(page.locator(".wmde-markdown")).toContainText(
      "Bearbeiteter Inhalt offline.",
    );
  });

  test("deleting a note offline syncs on reconnect", async ({ page }) => {
    const url = await createNote(page, "Bald weg", "Wird gelöscht.");
    const noteId = noteIdFromUrl(url);

    // Navigate to notes list so the sidebar item is visible
    await page.goto("/notes");
    await expect(
      page.getByRole("link", { name: "Bald weg" }),
    ).toBeVisible();

    // Go offline and delete via UI
    await page.context().setOffline(true);

    // Hover to reveal delete button, scoped to the specific note's list item
    const noteLink = page.getByRole("link", { name: "Bald weg" });
    const noteItem = page.locator("li", { has: noteLink });
    await noteLink.hover();
    await noteItem
      .getByRole("button", { name: "Notiz löschen" })
      .click();
    await page
      .getByRole("button", { name: "Endgültig löschen" })
      .click();

    // Wait for the UI to process the deletion
    await expect(noteLink).not.toBeVisible({ timeout: 5_000 });

    // Register response waiter before going online (sync fires immediately)
    const deleteResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/notes/") &&
        resp.request().method() === "DELETE" &&
        resp.ok(),
      { timeout: 15_000 },
    );
    await goOnline(page);
    await deleteResponse;

    // Reload and confirm gone from sidebar
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Bald weg" }),
    ).not.toBeVisible();

    // Confirm gone from server
    const getRes = await page.request.get(`/api/notes/${noteId}`);
    expect(getRes.status()).toBe(404);
  });
});
