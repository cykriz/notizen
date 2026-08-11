import { test, expect } from "@playwright/test";
import {
  FAILED_SYNC_CLOSE_LABEL,
  FAILED_SYNC_DISCARD_ALL_CONFIRM,
  FAILED_SYNC_DISCARD_ALL_LABEL,
  FAILED_SYNC_DISCARD_CONFIRM_LABEL,
  FAILED_SYNC_DISCARD_LABEL,
  FAILED_SYNC_EMPTY,
  FAILED_SYNC_ENTITY_LABEL,
  FAILED_SYNC_LABEL_LOCATION,
  FAILED_SYNC_LOCATION_LOCAL,
  FAILED_SYNC_OPEN_LABEL,
  FAILED_SYNC_PUSH_LABEL,
  FAILED_SYNC_PUSH_OFFLINE,
  FAILED_SYNC_CARD_LABEL,
  FAILED_SYNC_TODOS_FILE,
  FAILED_SYNC_TODO_QUADRANT,
} from "../../lib/failedSyncConstants";
import { FAILED_SYNC_TAG } from "../../lib/constants";
import { SYNC_ERROR_TITLE, SYNC_PENDING_LABEL } from "../../lib/syncStatusConstants";
import {
  createNote,
  deleteAllNotes,
  deleteAllTodos,
  goOffline,
  goOnline,
  noteIdFromUrl,
  openFailedSyncDialog,
  waitForPendingEntry,
  watchForHydrationErrors,
} from "./helpers";
import {
  readCachedTodos,
  readFailedQueue,
  readPendingQueue,
  seedFailedQueue,
  setRetryCount,
} from "./storageHelpers";

/** Offline-edit the open note so a PUT lands in the sync queue. */
async function editOffline(page: import("@playwright/test").Page, text: string) {
  // Wait for the editor to actually mount BEFORE cutting the network: its
  // CodeMirror chunk loads lazily and can still be in flight past networkidle,
  // in which case going offline strands it on the loading spinner forever.
  await expect(page.locator(".cm-content")).toBeVisible({ timeout: 20_000 });
  await goOffline(page);
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
  await waitForPendingEntry(page);
}

/** Fulfil every PUT with the given status until unrouted. */
async function failPuts(page: import("@playwright/test").Page, status: number) {
  await page.route("**/api/notes/*", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({ error: "Bad Request" }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe("Sync Failure Handling", () => {
  // Every test in this file is also a hydration guard: these are the flows that leave
  // pending/failed queue entries in localStorage, which is exactly the state that made
  // the hydration render disagree with the server HTML (React #418).
  let hydrationErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = watchForHydrationErrors(page);
    await page.goto("/notes");
    await deleteAllNotes(page);
    await page.reload();
  });

  test.afterEach(() => {
    expect(hydrationErrors).toEqual([]);
  });

  // Regression guard for React #418: the sync indicator's icon and the sidebar's
  // sync-fehler row are both derived from localStorage, which does not exist during
  // SSR. Reading either one in the render path makes the hydration render disagree
  // with the server HTML. Loading /notes offline with BOTH queues non-empty is the
  // cheapest way to catch the next such read.
  test("loading offline with pending and failed entries hydrates cleanly", async ({
    page,
  }) => {
    await createNote(page, "Hydration-Test", "Originaler Inhalt.");

    // A failed entry needs a rejected round trip.
    await editOffline(page, "Ungültiger Inhalt.");
    await failPuts(page, 400);
    await goOnline(page);
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    // Drop the 400 route first: it would intercept before the network and turn the
    // next edit into a second FAILED entry instead of leaving it pending.
    await page.unroute("**/api/notes/*");
    await editOffline(page, "Noch nicht uebertragen.");
    expect(await readPendingQueue(page)).not.toHaveLength(0);

    // /notes is precached at service-worker install, so this is served from the
    // cache and really does hydrate rather than falling back to /offline. Asserting
    // the indicator rendered keeps an empty watcher from passing for a dead page;
    // the afterEach owns the hydration assertion itself.
    await page.goto("/notes");
    await expect(
      page.getByRole("button", { name: FAILED_SYNC_OPEN_LABEL }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  // The note-detail counterpart: /notes/[id] is where the preview-mode and CodeMirror
  // theme fixes live, and neither is reachable from the /notes case above.
  //
  // Stays ONLINE and seeds the draft directly. The interesting input is only "server
  // note empty, local content non-empty" — driving that offline would depend on
  // warmPageCache having cached this URL's HTML in time, and a reload served from the
  // offline shell renders a neutral placeholder that cannot show the bug at all.
  test("reloading a note whose draft disagrees with the server hydrates cleanly", async ({
    page,
  }) => {
    await createNote(page, "Draft-Hydration", "");
    const id = noteIdFromUrl(page.url());

    // Server content is empty -> the server renders the editor; the draft is non-empty
    // -> after the mount the mode flips to preview. Reading the draft during hydration
    // is what used to swap <CodeMirror> for the preview container mid-render.
    await page.evaluate((noteId) => {
      localStorage.setItem(
        `notizen:draft:${noteId}`,
        JSON.stringify({ title: "Draft-Hydration", content: "Nur im Draft vorhanden." }),
      );
    }, id);

    await page.reload();
    // Mode-agnostic on purpose: the assertion is that the draft content rendered at all,
    // not which of the two subtrees won. afterEach owns the hydration assertion.
    await expect(page.getByText("Nur im Draft vorhanden.").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  // The theme leak needs the non-default theme: colorMode falls back to 'dark' before the
  // mount, so a dark-mode client cannot reveal a mismatch on the CodeMirror wrapper.
  test("reloading a note in light mode hydrates cleanly", async ({ page }) => {
    await createNote(page, "Theme-Hydration", "Inhalt fuer den Editor.");
    // next-themes has no explicit storageKey in app/providers.tsx, so this is its default.
    await page.evaluate(() => {
      localStorage.setItem("theme", "light");
    });

    await page.reload();
    await expect(page.getByText("Inhalt fuer den Editor.").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("CloudAlert opens the inspector instead of deleting", async ({ page }) => {
    await createNote(page, "Fehler-Test", "Originaler Inhalt.");
    await editOffline(page, "Offline-Bearbeitung.");

    // Exceed SYNC_MAX_RETRIES so the entry is given up on the next drain.
    await setRetryCount(page, 10);
    await goOnline(page);

    const failedBtn = page.getByRole("button", { name: FAILED_SYNC_OPEN_LABEL }).first();
    await expect(failedBtn).toBeVisible({ timeout: 10_000 });

    const dialog = await openFailedSyncDialog(page);

    // The whole point of the change: which note, where it lives, what is in it.
    await expect(dialog).toContainText("Fehler-Test");
    await expect(dialog).toContainText("Offline-Bearbeitung.");
    // Server path; the slug is date-prefixed and hash-suffixed by buildSlug.
    await expect(dialog).toContainText(/notes\/[^\s]*fehler-test[^\s]*\/note\.md/);

    // Opening must NOT discard anything — the old flow destroyed it on click.
    expect(await readFailedQueue(page)).toHaveLength(1);

    // Two-step discard-all: first click only arms it.
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_ALL_LABEL }).click();
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_ALL_CONFIRM }).click();

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 5_000 });
  });

  test("5xx error triggers retry and succeeds on recovery", async ({ page }) => {
    await createNote(page, "Retry-Test", "Wird synchronisiert.");
    await editOffline(page, "Retry-Inhalt.");

    // Intercept the first PUT to return 500, then let subsequent ones through
    let failCount = 0;
    await page.route("**/api/notes/*", async (route) => {
      if (route.request().method() === "PUT" && failCount < 1) {
        failCount++;
        await route.fulfill({ status: 500, body: "Internal Server Error" });
      } else {
        await route.continue();
      }
    });

    const successfulPut = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/notes/") &&
        resp.request().method() === "PUT" &&
        resp.ok(),
      { timeout: 30_000 },
    );
    await goOnline(page);
    await successfulPut;

    expect(await readPendingQueue(page)).toHaveLength(0);

    await page.reload();
    await page.getByRole("link", { name: "Retry-Test" }).click();
    await expect(page.locator(".wmde-markdown")).toContainText("Retry-Inhalt.", { timeout: 15_000 });
  });

  test("4xx non-retryable error records status and message", async ({ page }) => {
    await createNote(page, "Discard-Test", "Wird verworfen.");
    await editOffline(page, "Ungültiger Inhalt.");
    await failPuts(page, 400);
    await goOnline(page);

    await expect(async () => {
      expect(await readPendingQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 15_000 });

    const failed = await readFailedQueue(page);
    expect(failed).toHaveLength(1);
    expect(failed[0].failure?.reason).toBe("non-retryable");
    expect(failed[0].failure?.status).toBe(400);
    expect(failed[0].failure?.message).toContain("Bad Request");

    await expect(
      page.getByRole("button", { name: FAILED_SYNC_OPEN_LABEL }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("giving up after max retries inherits the last server status", async ({ page }) => {
    await createNote(page, "Status-Test", "Wird 503.");
    await editOffline(page, "503-Inhalt.");

    // Seed retryCount at SYNC_MAX_RETRIES - 1 so a single 503 trips the limit.
    // Timing: the first drain returns 'retry' (retryCount -> 5) and breaks; the
    // give-up happens on the NEXT backoff tick, SYNC_RETRY_INTERVAL_MS (10s)
    // later. A natural run from 0 would need >4 min of backoff.
    await setRetryCount(page, 4);
    await failPuts(page, 503);
    await goOnline(page);

    await expect(async () => {
      const failed = await readFailedQueue(page);
      expect(failed).toHaveLength(1);
      expect(failed[0].failure?.reason).toBe("max-retries");
      // The whole reason failures are also written onto the PENDING entry:
      // without it this would report no status at all.
      expect(failed[0].failure?.status).toBe(503);
    }).toPass({ timeout: 40_000 });
  });

  test("inspector shows folder and local-only storage for an offline-created note", async ({
    page,
  }) => {
    // Seeded rather than driven: an offline CREATE that never reached the server
    // is exactly a cached row with slug '' plus a failed create entry. Driving it
    // through the UI would need offline navigation to a brand-new note, which
    // exercises service-worker chunk caching instead of this feature.
    const id = "11111111-1111-4111-8111-111111111111";
    await page.evaluate((noteId) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "notizen:notes-list",
        JSON.stringify([
          {
            id: noteId,
            slug: "",
            title: "Offline-Notiz",
            createdAt: now,
            updatedAt: now,
            attachmentCount: 0,
            tags: ["arbeit/projekte"],
            pinned: false,
          },
        ]),
      );
    }, id);
    await seedFailedQueue(page, [
      {
        entityId: id,
        action: "create",
        payload: { id, title: "Offline-Notiz", content: "Nur lokal.", tags: ["arbeit/projekte"] },
      },
    ]);
    await page.reload();

    const dialog = await openFailedSyncDialog(page);
    await expect(dialog).toContainText(FAILED_SYNC_LOCATION_LOCAL);
    await expect(dialog).toContainText("Nur lokal.");
    await expect(dialog).toContainText("arbeit/projekte");
    // The synthetic marker tag must never surface as a real folder.
    await expect(dialog).not.toContainText(FAILED_SYNC_TAG);
  });

  test("the inspector stays open when the last entry is discarded from the sync-fehler folder", async ({
    page,
  }) => {
    // Regression: the dialog used to be rendered INSIDE the breadcrumb's
    // `currentPath !== '' && isFailedSyncTag` branch. Discarding the last entry
    // fires onEmptied -> setCurrentPath(''), which failed both guards and tore the
    // dialog down mid-interaction, so the "all transferred" state was never seen.
    await createNote(page, "Letzter-Eintrag", "Original.");
    await editOffline(page, "Nur dieser eine.");
    await setRetryCount(page, 10);
    await goOnline(page);

    // Leave the note first: discarding the note you are LOOKING AT deliberately
    // reloads to /notes (the only way to guarantee its editor cannot re-upload the
    // discarded text). The stay-open guarantee is about every other case.
    await page.goto("/notes");

    // Enter the synthetic folder, which is where the tear-down used to happen.
    await page.getByRole("button", { name: FAILED_SYNC_TAG }).click();
    await page
      .getByRole("button", { name: FAILED_SYNC_OPEN_LABEL })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    // Two-step: the first click only arms it (destroying the only copy of the
    // unsynced text must not happen on one stray click).
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();

    // Still mounted, now reporting completion rather than vanishing.
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(FAILED_SYNC_EMPTY);
    await dialog.getByRole("button", { name: FAILED_SYNC_CLOSE_LABEL }).click();
    await expect(dialog).toBeHidden();
  });

  test("an entry parked by a full localStorage can still be retried", async ({ page }) => {
    // A 'not-recorded' entry IS the pending entry, so pendingIds always contains
    // it. Blocking retry on that would disable the only way out of the parked
    // state behind a "transfer running" tooltip while nothing is running.
    await createNote(page, "Speicher-Voll", "Original.");
    await editOffline(page, "Geparkt.");
    const id = noteIdFromUrl(page.url());

    await page.evaluate(
      ({ noteId, max }) => {
        const raw = localStorage.getItem("notizen:sync-queue") ?? "[]";
        const queue = JSON.parse(raw) as Record<string, unknown>[];
        for (const entry of queue) {
          if (entry.entityId === noteId) {
            entry.retryCount = max;
            entry.failure = {
              reason: "not-recorded",
              failedAt: new Date().toISOString(),
              attempts: max,
            };
          }
        }

        localStorage.setItem("notizen:sync-queue", JSON.stringify(queue));
      },
      { noteId: id, max: 5 },
    );
    await goOnline(page);
    await page.reload();

    const dialog = await openFailedSyncDialog(page);
    const retry = dialog.getByRole("button", { name: FAILED_SYNC_PUSH_LABEL }).first();
    await expect(retry).toBeEnabled();
    await retry.click();

    // The requeue replaces the entry in place, clearing retryCount and failure,
    // so the normal drain picks it up and the queues end up empty.
    await expect(async () => {
      expect(await readPendingQueue(page)).toHaveLength(0);
      expect(await readFailedQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 20_000 });
  });

  test("retry syncs the entry after the server recovers", async ({ page }) => {
    await createNote(page, "Wiedervorlage", "Original.");
    await editOffline(page, "Nachtraeglich uebertragen.");
    await failPuts(page, 400);
    await goOnline(page);

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    // Server "recovers".
    await page.unroute("**/api/notes/*");

    const dialog = await openFailedSyncDialog(page);
    const successfulPut = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/notes/") &&
        resp.request().method() === "PUT" &&
        resp.ok(),
      { timeout: 30_000 },
    );
    await dialog.getByRole("button", { name: FAILED_SYNC_PUSH_LABEL }).click();
    await successfulPut;

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 10_000 });

    await page.reload();
    await page.getByRole("link", { name: "Wiedervorlage" }).click();
    await expect(page.locator(".wmde-markdown")).toContainText("Nachtraeglich uebertragen.", {
      timeout: 15_000,
    });
  });

  test("a note deleted server-side is re-created from the local copy", async ({ page }) => {
    // The case that used to dead-end: retry PUT -> 404 -> retry -> 404 forever, with
    // "copy it out and re-create it by hand" as the only way forward.
    await createNote(page, "Wiederanlegen", "Original.");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "Nur lokal vorhanden.");

    // Remove it server-side AND empty the trash, so re-create (not restore) applies.
    await page.request.delete(`/api/notes/${id}`);
    await page.request.delete(`/api/trash/note/${id}`);
    await goOnline(page);

    await expect(async () => {
      const failed = await readFailedQueue(page);
      expect(failed).toHaveLength(1);
      expect(failed[0].failure?.status).toBe(404);
    }).toPass({ timeout: 25_000 });

    const dialog = await openFailedSyncDialog(page);
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/notes") && r.request().method() === "POST" && r.ok(),
      { timeout: 20_000 },
    );
    await dialog.getByRole("button", { name: FAILED_SYNC_PUSH_LABEL }).click();
    await created;

    // Same id, local body — one button, no manual re-creation.
    await expect(async () => {
      const res = await page.request.get(`/api/notes/${id}`);
      expect(res.ok()).toBe(true);
      expect(((await res.json()) as { content: string }).content).toContain("Nur lokal vorhanden.");
    }).toPass({ timeout: 15_000 });

    expect(await readFailedQueue(page)).toHaveLength(0);
  });

  test("a trashed note is restored instead of being duplicated", async ({ page }) => {
    await createNote(page, "AusPapierkorb", "Original.");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "Nach dem Wiederherstellen.");

    // Trashed, NOT purged: createNote's id probe cannot see the trash, so a plain
    // POST here would write a second directory carrying this id.
    await page.request.delete(`/api/notes/${id}`);
    await goOnline(page);

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    const dialog = await openFailedSyncDialog(page);
    const restored = page.waitForResponse(
      (r) => r.url().includes(`/api/trash/note/${id}/restore`) && r.ok(),
      { timeout: 20_000 },
    );
    await dialog.getByRole("button", { name: FAILED_SYNC_PUSH_LABEL }).click();
    await restored;

    await expect(async () => {
      const list = (await (await page.request.get("/api/notes")).json()) as { id: string }[];
      // Exactly one row for this id — a duplicate would show two.
      expect(list.filter((n) => n.id === id)).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    const res = await page.request.get(`/api/notes/${id}`);
    expect(((await res.json()) as { content: string }).content).toContain("Nach dem Wiederherstellen.");
  });

  test("discarding one entry leaves the others untouched", async ({ page }) => {
    const firstUrl = await createNote(page, "Erste", "Inhalt eins.");
    await page.goto("/notes");
    await createNote(page, "Zweite", "Inhalt zwei.");
    const firstId = noteIdFromUrl(firstUrl);
    const secondId = noteIdFromUrl(page.url());

    // Seeded: two independent failures. Driving both through the UI would need
    // two offline/online cycles with a navigation in between.
    await seedFailedQueue(page, [
      { entityId: firstId, payload: { content: "Eins geaendert." } },
      { entityId: secondId, payload: { content: "Zwei geaendert." } },
    ]);
    await page.goto("/notes");

    const dialog = await openFailedSyncDialog(page);
    await expect(dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL })).toHaveCount(2);
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    // Two-step: the first click only arms it (destroying the only copy of the
    // unsynced text must not happen on one stray click).
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 5_000 });
    await expect(dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL })).toHaveCount(1);

    // The survivor is now the only entry, so it must expand itself. Collapsible
    // reads defaultOpen once per mount and the row key is stable, so this only
    // holds because the row drives `open` from the soleEntry edge.
    // exact: the dialog description also contains the word "Speicherort".
    await expect(dialog.getByText(FAILED_SYNC_LABEL_LOCATION, { exact: true })).toBeVisible();

    // The indicator must stay — one failure is still unresolved. Assert it only
    // AFTER closing: Radix aria-hides the background while the dialog is open, so
    // a role query would report "not found" no matter what the indicator shows.
    await dialog.getByRole("button", { name: FAILED_SYNC_CLOSE_LABEL }).click();
    await expect(
      page.getByRole("button", { name: FAILED_SYNC_OPEN_LABEL }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("a later successful direct write clears the stale failure", async ({ page }) => {
    // processSyncQueue drops the failure record on a successful replay, but the
    // ONLINE fast path in update*Offline wrote straight to the API and left it
    // behind — so the indicator kept flagging content that was already synced, and
    // the inspector offered to discard it.
    await createNote(page, "StaleRecord", "ONLINE");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "OFFLINE");
    await setRetryCount(page, 10);
    await goOnline(page);

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    // Typing again online takes the direct-fetch path (the queue is empty now).
    await page.locator(".cm-content").click();
    await page.keyboard.type("!");
    await page.waitForResponse(
      (r) => r.url().includes("/api/notes/") && r.request().method() === "PUT" && r.ok(),
      { timeout: 15_000 },
    );

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 10_000 });

    const res = await page.request.get(`/api/notes/${id}`);
    expect(((await res.json()) as { content: string }).content).toContain("OFFLINE");
  });

  test("discarding the open note leaves it, so auto-save cannot push the text back", async ({
    page,
  }) => {
    // Purging the cache does not reach an OPEN editor: NoteEditor seeded its state
    // from the cache at mount and useAutoSave compares that against the SSR prop,
    // so isDirty stays true and the next keystroke re-uploads the discarded text.
    await createNote(page, "OffenerEditor", "SERVER-STAND");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "VERWORFENER-STAND");
    await setRetryCount(page, 10);
    await goOnline(page);

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    // Discard WITHOUT navigating away first.
    const dialog = await openFailedSyncDialog(page);
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();

    // The editor must be gone, not just showing stale text.
    await expect(page).toHaveURL(/\/notes$/, { timeout: 10_000 });
    await expect(page.locator(".cm-content")).toHaveCount(0);

    // And the server must still hold its own version.
    await page.waitForTimeout(2000);
    const res = await page.request.get(`/api/notes/${id}`);
    expect(((await res.json()) as { content: string }).content).not.toContain("VERWORFENER-STAND");
  });

  test("discarding also drops a queued edit, so it cannot upload afterwards", async ({ page }) => {
    // "Lokal löschen" means the local change is unwanted. discardEntry used to bail
    // out when any mutation was still queued for the entity, leaving it to sync —
    // uploading exactly what had just been discarded. A queue entry carries its own
    // payload, so purging the caches cannot prevent that.
    await createNote(page, "QueuedEdit", "ONLINE");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "OFFLINE");
    await setRetryCount(page, 10);
    await goOnline(page);
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    // A second offline edit: now a PENDING entry coexists with the failure record.
    await goOffline(page);
    await page.locator(".cm-content").click();
    await page.keyboard.type("-ZWEITE");
    await waitForPendingEntry(page);

    const dialog = await openFailedSyncDialog(page);
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();
    await goOnline(page);

    await expect(async () => {
      expect(await readPendingQueue(page)).toHaveLength(0);
      const res = await page.request.get(`/api/notes/${id}`);
      expect(((await res.json()) as { content: string }).content).toBe("ONLINE");
    }).toPass({ timeout: 20_000 });
  });

  test("the note cache is purged on discard, whatever the payload carried", async ({ page }) => {
    // Straight from a real report: after discarding, notizen:note:<id> still held
    // the offline text with an updatedAt NEWER than the server's, so
    // useNoteInitialState preferred it, the editor showed it, and auto-save
    // uploaded it. The purge used to be gated on the payload carrying title or
    // content; it is unconditional now.
    await createNote(page, "CachePurge", "ONLINE");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "OFFLINE");
    await setRetryCount(page, 10);
    await goOnline(page);
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    const dialog = await openFailedSyncDialog(page);
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();
    await expect(page).toHaveURL(/\/notes$/, { timeout: 15_000 });

    const state = await page.evaluate(
      (n) => ({
        cached: localStorage.getItem(`notizen:note:${n}`),
        draft: localStorage.getItem(`notizen:draft:${n}`),
      }),
      id,
    );
    expect(state.cached).toBeNull();
    expect(state.draft).toBeNull();

    // And nothing re-uploads it afterwards.
    await page.waitForTimeout(2500);
    const res = await page.request.get(`/api/notes/${id}`);
    expect(((await res.json()) as { content: string }).content).toBe("ONLINE");
  });

  test("re-opening a discarded note shows the server version", async ({ page }) => {
    await createNote(page, "ReopenNote", "ONLINE");
    const id = noteIdFromUrl(page.url());
    await editOffline(page, "OFFLINE");
    await setRetryCount(page, 10);
    await goOnline(page);
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    const dialog = await openFailedSyncDialog(page);
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();
    await page.keyboard.press("Escape");

    // A non-empty note re-opens in PREVIEW mode, so assert on the rendered markdown.
    await page.getByRole("link", { name: "ReopenNote" }).click();
    await expect(page.locator(".wmde-markdown")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".wmde-markdown")).not.toContainText("OFFLINE");

    const res = await page.request.get(`/api/notes/${id}`);
    expect(((await res.json()) as { content: string }).content).toBe("ONLINE");
  });

  test("a discarded title does not come back", async ({ page }) => {
    // Regression: update*Offline writes the title into notizen:notes-list with a
    // fresh updatedAt, and mergeById then prefers that local row forever. Before
    // the purge path, a discarded title sat in the sidebar permanently.
    await createNote(page, "Server-Titel", "Inhalt.");
    await goOffline(page);
    await page.locator("#note-title").fill("Verworfener Titel");
    await waitForPendingEntry(page);

    await failPuts(page, 400);
    await goOnline(page);

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    const dialog = await openFailedSyncDialog(page);
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    // Two-step: the first click only arms it (destroying the only copy of the
    // unsynced text must not happen on one stray click).
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 5_000 });

    await page.unroute("**/api/notes/*");
    await page.reload();
    await expect(page.getByRole("link", { name: "Server-Titel" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Verworfener Titel" })).toHaveCount(0);

    // Second half of the same leak: useNoteInitialState reads title+content back
    // out of notizen:note:<id>, whose updatedAt is newer than the server's. If the
    // note cache survived the discard, opening the note would show the discarded
    // title again and auto-save would push it straight back.
    await page.getByRole("link", { name: "Server-Titel" }).click();
    await expect(page.locator("#note-title")).toHaveValue("Server-Titel", { timeout: 15_000 });
  });

  test("the inspector stays reachable and honest while offline", async ({ page }) => {
    // The !isOnline branch used to return an inert CloudOff BEFORE the failed
    // branch, hiding unsynced changes exactly when inspecting them matters most.
    // The dialog is localStorage-only, so it works fully offline.
    await createNote(page, "OfflineReach", "ONLINE");
    await editOffline(page, "OFFLINE");
    await setRetryCount(page, 10);
    await goOnline(page);
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 25_000 });

    await goOffline(page);

    // Still a clickable indicator, not a dead icon.
    const indicator = page.getByRole("button", { name: FAILED_SYNC_OPEN_LABEL }).first();
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveAttribute("title", /^Offline —/);

    const dialog = await openFailedSyncDialog(page);
    await expect(dialog).toContainText("OfflineReach");
    await expect(dialog).toContainText("OFFLINE");

    // Uploading needs the network, and the tooltip must not promise that it will
    // happen by itself later — a recorded failure lives in notizen:sync-failed,
    // which processSyncQueue never reads.
    const push = dialog.getByRole("button", { name: FAILED_SYNC_PUSH_LABEL });
    await expect(push).toBeDisabled();
    await expect(push).toHaveAttribute("title", FAILED_SYNC_PUSH_OFFLINE);
    expect(FAILED_SYNC_PUSH_OFFLINE).not.toContain("automatisch");
  });

  test("a failed todo is listed as Aufgabe with its details", async ({ page }) => {
    // Failed todos have no marker anywhere else in the app — no sync-fehler folder,
    // no per-todo route — so the inspector is the only place they surface.
    await page.goto("/todos");
    const quickAdd = page.getByPlaceholder("Neue Aufgabe…").first();
    await quickAdd.click();
    await quickAdd.fill("KaputteAufgabe");
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/todos") && r.request().method() === "POST" && r.ok(),
      { timeout: 15_000 },
    );
    await quickAdd.press("Enter");
    await created;

    // Offline toggle -> a queued todo mutation.
    await goOffline(page);
    await page.getByRole("checkbox").first().click();
    await waitForPendingEntry(page);
    await setRetryCount(page, 10);
    await goOnline(page);

    await expect(async () => {
      const failed = await readFailedQueue(page);
      expect(failed).toHaveLength(1);
      expect(failed[0].entityType).toBe("todo");
    }).toPass({ timeout: 25_000 });

    const dialog = await openFailedSyncDialog(page);
    await expect(dialog).toContainText("KaputteAufgabe");
    await expect(dialog).toContainText(FAILED_SYNC_ENTITY_LABEL.todo);
    // Todos live in one file and carry their quadrant inline, since "open" can
    // only reach the matrix page.
    await expect(dialog).toContainText(FAILED_SYNC_TODOS_FILE);
    await expect(dialog).toContainText(FAILED_SYNC_TODO_QUADRANT);

    // And the destructive direction works for todos too.
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_LABEL }).first().click();
    await dialog.getByRole("button", { name: FAILED_SYNC_DISCARD_CONFIRM_LABEL }).click();
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(0);
    }).toPass({ timeout: 10_000 });
  });

  test("failed entries survive the cache TTL sweep", async ({ page }) => {
    // Regression: cleanExpiredFailedEntries used to run BEFORE pendingEntityIds(),
    // so after 7 days the entry expired and the same pass then deleted
    // notizen:note:<id> — silent content loss with no user action.
    await createNote(page, "TTL-Test", "Muss ueberleben.");
    await editOffline(page, "Alter Eintrag.");
    await failPuts(page, 400);
    await goOnline(page);

    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    // Backdate the entry and its cache metadata well past CACHE_TTL_MS.
    const noteId = (await readFailedQueue(page))[0].entityId;
    await page.evaluate((id) => {
      const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const raw = localStorage.getItem("notizen:sync-failed");
      if (raw) {
        const queue = JSON.parse(raw) as { timestamp: string }[];
        for (const e of queue) e.timestamp = old;
        localStorage.setItem("notizen:sync-failed", JSON.stringify(queue));
      }
      localStorage.setItem(`notizen:cached-at:notizen:note:${id}`, old);
    }, noteId);

    // cleanExpiredEntries runs on mount.
    await page.reload();
    await expect(async () => {
      expect(await readFailedQueue(page)).toHaveLength(1);
      const cached = await page.evaluate(
        (id) => localStorage.getItem(`notizen:note:${id}`),
        noteId,
      );
      expect(cached).not.toBeNull();
    }).toPass({ timeout: 10_000 });
  });
});

test.describe("Todo sync", () => {
  test.beforeEach(async ({ page }) => {
    // Todos survive between tests otherwise, and every `.first()` below would
    // silently act on a leftover card from an earlier case.
    await page.goto("/todos");
    await deleteAllTodos(page);
    await page.reload();
  });

  /** Quick-add a todo and wait for the server to acknowledge it. */
  async function addTodo(page: import("@playwright/test").Page, title: string) {
    await page.goto("/todos");
    const quickAdd = page.getByPlaceholder("Neue Aufgabe…").first();
    await quickAdd.click();
    await quickAdd.fill(title);
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/todos") && r.request().method() === "POST" && r.ok(),
      { timeout: 15_000 },
    );
    await quickAdd.press("Enter");
    await created;
  }

  test("a second change to the same todo still reaches the server", async ({ page }) => {
    // THE regression. updateTodoOffline used to discard the PUT response, so the
    // cache kept the client's updatedAt while the server had its own. The next
    // edit sent that stale value as X-Expected-UpdatedAt, got a 409, and fell out
    // of an if/else with no else branch — no queue entry, no failure record, no
    // log. Result: the first edit synced, every later one vanished silently.
    await addTodo(page, "ZweiteAenderung");

    const puts: number[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/todos/") && r.request().method() === "PUT") {
        puts.push(r.status());
      }
    });

    await page.getByRole("checkbox").first().click();
    await expect(async () => {
      expect(puts.filter((s) => s === 200)).toHaveLength(1);
    }).toPass({ timeout: 15_000 });

    // Second edit on the same row — this is the one that used to disappear.
    await page.getByText("ZweiteAenderung").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Erledigen" }).click();
    await dialog.getByRole("button", { name: /Speichern/ }).click();

    await expect(async () => {
      expect(puts.filter((s) => s === 200).length).toBeGreaterThanOrEqual(2);
      expect(puts).not.toContain(409);
    }).toPass({ timeout: 15_000 });

    // And the server really holds the move, not just the checkbox.
    const onServer = await page.evaluate(async () => {
      const res = await fetch("/api/todos");
      return (await res.json()) as { title: string; quadrant: string; completed: boolean }[];
    });
    const row = onServer.find((t) => t.title === "ZweiteAenderung");
    expect(row?.quadrant).toBe("do");
    expect(row?.completed).toBe(true);
  });

  test("a rejected todo change lands in the inspector immediately", async ({ page }) => {
    // Deterministic 4xx goes straight to the failed queue instead of burning
    // five backoff cycles and blocking the shared FIFO behind it.
    await addTodo(page, "AbgelehnteAufgabe");
    await page.route("**/api/todos/*", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 400, body: JSON.stringify({ error: "nope" }) })
        : route.continue(),
    );

    await page.getByRole("checkbox").first().click();

    await expect(async () => {
      const failed = await readFailedQueue(page);
      expect(failed).toHaveLength(1);
      expect(failed[0].entityType).toBe("todo");
      expect(failed[0].failure?.status).toBe(400);
    }).toPass({ timeout: 15_000 });

    // The card itself carries the marker — todos have no sidebar folder.
    await expect(page.getByText(FAILED_SYNC_CARD_LABEL).first()).toBeVisible();
  });

  test("a rejected todo create survives a refresh instead of being dropped", async ({ page }) => {
    // A 5xx on create used to only console.error: no queue entry, so mergeById's
    // cache-only branch dropped the row on the next pull and persisted the loss.
    await page.goto("/todos");
    await page.route("**/api/todos", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 500, body: JSON.stringify({ error: "kaputt" }) })
        : route.continue(),
    );

    const quickAdd = page.getByPlaceholder("Neue Aufgabe…").first();
    await quickAdd.click();
    await quickAdd.fill("UeberlebtRefresh");
    await quickAdd.press("Enter");

    await waitForPendingEntry(page);
    expect((await readPendingQueue(page))[0].action).toBe("create");
    await expect(page.getByText("UeberlebtRefresh")).toBeVisible();
  });

  test("moving and ticking offline sends both fields", async ({ page }) => {
    // enqueueMutation replaced same-action entries wholesale, so the {quadrant}
    // payload was overwritten by {completed} and the move never left the device.
    await addTodo(page, "BeideFelder");
    await goOffline(page);

    await page.getByText("BeideFelder").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Erledigen" }).click();
    await dialog.getByRole("button", { name: /Speichern/ }).click();
    await waitForPendingEntry(page);

    await page.getByRole("checkbox").first().click();
    await expect(async () => {
      const updates = (await readPendingQueue(page)).filter((e) => e.action === "update");
      expect(updates).toHaveLength(1);
      expect(updates[0].payload).toMatchObject({ quadrant: "do", completed: true });
    }).toPass({ timeout: 10_000 });

    await goOnline(page);
    await expect(async () => {
      const onServer = await page.evaluate(async () => {
        const res = await fetch("/api/todos");
        return (await res.json()) as { title: string; quadrant: string; completed: boolean }[];
      });
      const row = onServer.find((t) => t.title === "BeideFelder");
      expect(row?.quadrant).toBe("do");
      expect(row?.completed).toBe(true);
    }).toPass({ timeout: 25_000 });
  });

  test("a failed entry survives a later successful partial write", async ({ page }) => {
    // removeFromFailedSync keys only on (entityType, entityId), so ticking the
    // checkbox used to erase a failed quadrant move — a change the server never
    // received disappeared from the inspector. subtractAckedKeys keeps the rest.
    await addTodo(page, "TeilAck");

    await seedFailedQueue(page, [
      {
        entityType: "todo",
        entityId: (await readCachedTodos(page)).find((t) => t.title === "TeilAck")?.id as string,
        action: "update",
        payload: { quadrant: "do" },
      },
    ]);

    await page.getByRole("checkbox").first().click();

    await expect(async () => {
      const failed = await readFailedQueue(page);
      expect(failed).toHaveLength(1);
      expect(failed[0].payload).toEqual({ quadrant: "do" });
    }).toPass({ timeout: 15_000 });
  });

  test("a manual sync that cannot empty the outbox shows the error state", async ({ page }) => {
    // The error branch used to be unreachable: refreshFromServer swallows its own
    // failures, so handleSync's catch never fired and CloudAlert was dead code.
    // processSyncQueue does not reject on a 5xx either — it pauses the drain — so
    // the honest signal is what is still queued after the push.
    await addTodo(page, "StummerFehler");
    await goOffline(page);
    await page.getByRole("checkbox").first().click();
    await waitForPendingEntry(page);

    await page.route("**/api/todos/*", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 500, body: "Internal Server Error" })
        : route.continue(),
    );
    await goOnline(page);

    const button = page.getByRole("button", { name: SYNC_PENDING_LABEL });
    await expect(button).toBeVisible({ timeout: 15_000 });
    await button.click();

    await expect(page.getByRole("button", { name: SYNC_PENDING_LABEL })).toHaveAttribute(
      "title",
      SYNC_ERROR_TITLE,
      { timeout: 15_000 },
    );
  });

  test("the pending indicator is a button, not an inert span", async ({ page }) => {
    // The regression: the icon stopped being clickable exactly when there was
    // unsent work. Asserted with the push failing, so the outbox stays non-empty
    // and the pending state cannot race the automatic drain — otherwise the label
    // flips to the idle one mid-assertion. That the click actually pushes is
    // covered by the error-state test above, which reaches a state only syncNow
    // can produce.
    await addTodo(page, "ManuellerPush");
    await page.route("**/api/todos/*", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 500, body: "Internal Server Error" })
        : route.continue(),
    );

    await goOffline(page);
    await page.getByRole("checkbox").first().click();
    await waitForPendingEntry(page);

    // The failed branch outranks the pending one, so this must be a clean queue.
    expect(await readFailedQueue(page)).toHaveLength(0);
    await goOnline(page);

    const button = page.getByRole("button", { name: SYNC_PENDING_LABEL });
    await expect(button).toBeVisible({ timeout: 15_000 });
    await expect(button).toBeEnabled();
  });
});
