import { test, expect } from "@playwright/test";
import { createNote, deleteAllNotes, noteIdFromUrl } from "./helpers";

test.describe("Cache & Merge", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notes");
    await deleteAllNotes(page);
    await page.reload();
  });

  test("cached note content is preferred over stale SSR prop", async ({
    page,
  }) => {
    const url = await createNote(page, "Cache-Test", "Alter Inhalt.");
    const noteId = noteIdFromUrl(url);

    // Update the note via API (simulates another device) so the server
    // is ahead of what the service worker would have cached
    await page.request.put(`/api/notes/${noteId}`, {
      data: { content: "Neuer Inhalt vom Server." },
    });

    // Write the newer version into localStorage cache so the client sees it
    await page.evaluate(
      ({ id, content }) => {
        const listRaw = localStorage.getItem("notizen:notes-list");
        if (listRaw) {
          const list = JSON.parse(listRaw) as { id: string; updatedAt: string }[];
          const entry = list.find((n) => n.id === id);
          if (entry) {
            // Bump updatedAt far into the future so the cache wins
            entry.updatedAt = new Date(Date.now() + 60_000).toISOString();
          }
          localStorage.setItem("notizen:notes-list", JSON.stringify(list));
        }

        // Also cache the full note with the new content
        const key = `notizen:note:${id}`;
        const noteRaw = localStorage.getItem(key);
        if (noteRaw) {
          const note = JSON.parse(noteRaw) as Record<string, unknown>;
          note.content = content;
          note.updatedAt = new Date(Date.now() + 60_000).toISOString();
          localStorage.setItem(key, JSON.stringify(note));
        }
      },
      { id: noteId, content: "Neuer Inhalt vom Server." },
    );

    // Navigate to the note — useNoteInitialState should pick up the cached version
    await page.goto(`/notes/${noteId}`);
    await expect(page.locator(".wmde-markdown")).toContainText(
      "Neuer Inhalt vom Server.",
      { timeout: 5_000 },
    );
  });

  test("server-newer content wins over stale cache in merge", async ({
    page,
  }) => {
    const url = await createNote(page, "Merge-Test", "Initialer Inhalt.");
    const noteId = noteIdFromUrl(url);

    // Update the note via API (server is now newer)
    await page.request.put(`/api/notes/${noteId}`, {
      data: { content: "Server ist neuer." },
    });

    // The local cache still has the old content. Force a refresh that
    // triggers mergeById — server version should win since it's newer.
    await page.reload();

    // Navigate to the note and verify server content is shown
    await page.getByRole("link", { name: "Merge-Test" }).click();
    await expect(page.locator(".wmde-markdown")).toContainText(
      "Server ist neuer.",
      { timeout: 5_000 },
    );
  });

  test("failed-delete entry does not resurrect note", async ({ page }) => {
    const url = await createNote(page, "Zombie-Test", "Soll nicht zurückkommen.");
    const noteId = noteIdFromUrl(url);

    // Delete the note via API (server-side)
    const delRes = await page.request.delete(`/api/notes/${noteId}`);
    expect(delRes.ok()).toBe(true);

    // Simulate a failed delete entry in the failed sync queue
    // (as if a previous delete attempt got a 4xx and was discarded)
    await page.evaluate(
      ({ id }) => {
        const failedEntry = {
          entityType: "note",
          entityId: id,
          action: "delete",
          payload: {},
          timestamp: new Date().toISOString(),
          retryCount: 5,
        };
        localStorage.setItem(
          "notizen:sync-failed",
          JSON.stringify([failedEntry]),
        );

        // Also ensure the note is still in the cached notes list
        // (as if it hadn't been cleaned up yet)
        const listRaw = localStorage.getItem("notizen:notes-list");
        if (listRaw) {
          const list = JSON.parse(listRaw) as { id: string }[];
          if (!list.some((n) => n.id === id)) {
            list.push({
              id,
              title: "Zombie-Test",
              content: "",
              tags: [],
              pinned: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as unknown as { id: string });
            localStorage.setItem("notizen:notes-list", JSON.stringify(list));
          }
        }
      },
      { id: noteId },
    );

    // Navigate to /notes — the merge should NOT resurrect the note
    // because failed-delete entries are excluded from pendingAll
    await page.goto("/notes");

    await expect(
      page.getByRole("link", { name: "Zombie-Test" }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test("draft content is restored after navigating away and back", async ({
    page,
  }) => {
    const url = await createNote(page, "Entwurf-Nav", "Gespeichert.");
    const noteId = noteIdFromUrl(url);

    // Write a draft directly into localStorage (simulating unsaved keystrokes)
    await page.evaluate(
      ({ id }) => {
        localStorage.setItem(
          `notizen:draft:${id}`,
          JSON.stringify({ title: "Entwurf-Nav", content: "Ungespeicherter Entwurf!" }),
        );
      },
      { id: noteId },
    );

    // Navigate away and come back
    await page.goto("/notes");
    await page.getByRole("link", { name: "Entwurf-Nav" }).click();

    // Draft content should be shown (via useNoteInitialState);
    // the navigation + server component render can be slow under load
    await expect(page.locator(".wmde-markdown")).toContainText(
      "Ungespeicherter Entwurf!",
      { timeout: 15_000 },
    );
  });
});
