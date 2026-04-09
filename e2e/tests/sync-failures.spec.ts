import { test, expect } from "@playwright/test";
import { createNote, deleteAllNotes, goOffline, goOnline } from "./helpers";

test.describe("Sync Failure Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notes");
    await deleteAllNotes(page);
    await page.reload();
  });

  test("failed sync shows CloudAlert and can be dismissed", async ({
    page,
  }) => {
    // Create a note so we have something to edit offline
    await createNote(page, "Fehler-Test", "Originaler Inhalt.");

    // Go offline, edit, which enqueues a PUT in the sync queue
    await goOffline(page);
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Offline-Bearbeitung.");

    // Wait for auto-save to write to localStorage
    await expect(async () => {
      const hasPending = await page.evaluate(() => {
        const raw = localStorage.getItem("notizen:sync-queue");
        if (!raw) return false;
        return (JSON.parse(raw) as unknown[]).length > 0;
      });
      expect(hasPending).toBe(true);
    }).toPass({ timeout: 5_000 });

    // Manually set retryCount to exceed SYNC_MAX_RETRIES (5) so the entry
    // is moved to failed queue on the very next processSyncQueue call
    await page.evaluate(() => {
      const raw = localStorage.getItem("notizen:sync-queue");
      if (!raw) return;
      const queue = JSON.parse(raw) as { retryCount?: number }[];
      for (const entry of queue) {
        entry.retryCount = 10;
      }
      localStorage.setItem("notizen:sync-queue", JSON.stringify(queue));
    });

    // Go back online — the sync will pick up the entry, see retryCount >= 5,
    // and move it to the failed queue
    await goOnline(page);

    // CloudAlert icon should appear
    const failedBtn = page.getByRole("button", {
      name: "Fehlgeschlagene Synchronisierungen verwerfen",
    });
    await expect(failedBtn).toBeVisible({ timeout: 10_000 });

    // Click to dismiss
    await failedBtn.click();

    // CloudAlert should disappear and normal cloud icon should show
    await expect(failedBtn).not.toBeVisible({ timeout: 5_000 });
  });

  test("5xx error triggers retry and succeeds on recovery", async ({
    page,
  }) => {
    await createNote(page, "Retry-Test", "Wird synchronisiert.");

    // Go offline and edit
    await goOffline(page);
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Retry-Inhalt.");

    // Wait for sync queue entry
    await expect(async () => {
      const count = await page.evaluate(() => {
        const raw = localStorage.getItem("notizen:sync-queue");
        return raw ? (JSON.parse(raw) as unknown[]).length : 0;
      });
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

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

    // Go online — first attempt gets 500, retry should succeed
    const successfulPut = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/notes/") &&
        resp.request().method() === "PUT" &&
        resp.ok(),
      { timeout: 30_000 },
    );
    await goOnline(page);
    await successfulPut;

    // Sync queue should be empty
    const remaining = await page.evaluate(() => {
      const raw = localStorage.getItem("notizen:sync-queue");
      return raw ? (JSON.parse(raw) as unknown[]).length : 0;
    });
    expect(remaining).toBe(0);

    // Verify content persisted on server
    await page.reload();
    await page.getByRole("link", { name: "Retry-Test" }).click();
    await expect(page.locator(".wmde-markdown")).toContainText("Retry-Inhalt.", { timeout: 15_000 });
  });

  test("4xx non-retryable error is moved to failed queue", async ({
    page,
  }) => {
    await createNote(page, "Discard-Test", "Wird verworfen.");

    // Go offline and edit
    await goOffline(page);
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Ungültiger Inhalt.");

    // Wait for sync queue entry
    await expect(async () => {
      const count = await page.evaluate(() => {
        const raw = localStorage.getItem("notizen:sync-queue");
        return raw ? (JSON.parse(raw) as unknown[]).length : 0;
      });
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 5_000 });

    // Intercept PUT to return 400 (non-retryable)
    await page.route("**/api/notes/*", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Bad Request" }),
        });
      } else {
        await route.continue();
      }
    });

    await goOnline(page);

    // Wait until the sync queue is drained (entry moved to failed)
    await expect(async () => {
      const syncCount = await page.evaluate(() => {
        const raw = localStorage.getItem("notizen:sync-queue");
        return raw ? (JSON.parse(raw) as unknown[]).length : 0;
      });
      expect(syncCount).toBe(0);
    }).toPass({ timeout: 15_000 });

    // Failed queue should have the entry
    const failedCount = await page.evaluate(() => {
      const raw = localStorage.getItem("notizen:sync-failed");
      return raw ? (JSON.parse(raw) as unknown[]).length : 0;
    });
    expect(failedCount).toBeGreaterThan(0);

    // CloudAlert should be visible
    await expect(
      page.getByRole("button", {
        name: "Fehlgeschlagene Synchronisierungen verwerfen",
      }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
