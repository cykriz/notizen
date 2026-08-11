import { test, expect } from "@playwright/test";
import { createNote, deleteAllNotes, goOffline, waitForSave, goOnline, noteIdFromUrl } from "./helpers";

test.describe("Data Integrity", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notes");
    await deleteAllNotes(page);
    await page.reload();
  });

  // Clearing the title used to PUT `title: ''`, which the route rejects with
  // min(1) -> 400 -> non-retryable -> the whole entry (content included) went to the
  // failed-sync inspector and never reached the server. buildNoteSavePayload now
  // omits a blank title instead.
  test("clearing the title keeps saving instead of failing with 400", async ({
    page,
  }) => {
    const noteUrl = await createNote(page, "Titel-Test", "Inhalt eins.");
    const noteId = noteIdFromUrl(noteUrl);

    // The autosave must fire while the title is still empty AND the field still has
    // focus. Leaving the field first would let the onBlur normalisation replace the
    // title with the fallback, so the invalid payload would never be sent and this
    // test could not fail — verified by reverting the fix.
    const put = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/notes/${noteId}`) && resp.request().method() === "PUT",
      { timeout: 15_000 },
    );
    await page.locator("#note-title").fill("");
    const resp = await put;

    // 400 = "Too small: expected string to have >=1 characters" -> non-retryable ->
    // the whole entry, content included, would land in the failed-sync inspector.
    expect(resp.status()).toBe(200);

    // Blur normalises the still-blank field so it cannot disagree with the server.
    await page.locator(".cm-content").click();
    await expect(page.locator("#note-title")).toHaveValue("Unbenannt");

    // And a following content edit still saves and survives a reload.
    const saved = waitForSave(page);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Inhalt zwei.");
    await saved;

    await page.reload();
    await expect(page.getByText("Inhalt zwei.").first()).toBeVisible({ timeout: 20_000 });
  });

  test("pinning a note offline does not wipe its content", async ({
    page,
  }) => {
    const noteUrl = await createNote(page, "Pin-Test", "Wichtiger Inhalt hier.");
    const noteId = noteIdFromUrl(noteUrl);

    // Navigate to /notes so sidebar is visible with the note
    await page.goto("/notes");
    await expect(
      page.getByRole("link", { name: "Pin-Test" }),
    ).toBeVisible();

    // Go offline and pin the note
    await goOffline(page);
    const noteLink = page.getByRole("link", { name: "Pin-Test" });
    const noteItem = page.locator("li", { has: noteLink });
    await noteLink.hover();
    await noteItem
      .getByRole("button", { name: "Notiz anheften" })
      .click();

    // Wait for the pin update to write to localStorage
    await expect(async () => {
      const isPinned = await page.evaluate(() => {
        const raw = localStorage.getItem("notizen:notes-list");
        if (!raw) return false;
        const list = JSON.parse(raw) as { title: string; pinned: boolean }[];
        return list.find((n) => n.title === "Pin-Test")?.pinned ?? false;
      });
      expect(isPinned).toBe(true);
    }).toPass({ timeout: 5_000 });

    // Go online and poll server until the pin has been synced
    await goOnline(page);
    await expect(async () => {
      const res = await page.request.get(`/api/notes/${noteId}`);
      const note = (await res.json()) as { pinned: boolean };
      expect(note.pinned).toBe(true);
    }).toPass({ timeout: 20_000 });

    // Reload and verify content was NOT wiped
    await page.reload();
    // Pinned note appears twice (pinned section + all notes), pick the first
    await page.getByRole("link", { name: "Pin-Test" }).first().click();
    await expect(page.locator(".wmde-markdown")).toContainText(
      "Wichtiger Inhalt hier.",
      { timeout: 15_000 },
    );
  });

  test("renaming title does not lose body content", async ({ page }) => {
    await createNote(page, "Alter Titel", "Body darf nicht verschwinden.");

    const titleInput = page.locator("#note-title");

    // Rename the title only
    await titleInput.fill("Neuer Titel");

    // Wait for the auto-save to fire
    await waitForSave(page);

    // Reload and verify body is intact
    await page.reload();
    await page.getByRole("link", { name: "Neuer Titel" }).click();
    await expect(titleInput).toHaveValue("Neuer Titel");
    await expect(page.locator(".wmde-markdown")).toContainText(
      "Body darf nicht verschwinden.",
    );
  });

  test("rapid edits are fully captured by debounced save", async ({
    page,
  }) => {
    await createNote(page, "Schnell-Test", "Start.");
    const editor = page.locator(".cm-content");

    // Type three bursts of text rapidly (within the 1s debounce window)
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Erster Absatz.");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Zweiter Absatz.");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Dritter Absatz.");

    // Wait for the debounced save to fire (should capture everything)
    await waitForSave(page);

    // Reload and verify all three paragraphs survived
    await page.reload();
    await page.getByRole("link", { name: "Schnell-Test" }).click();
    const preview = page.locator(".wmde-markdown");
    await expect(preview).toContainText("Erster Absatz.", { timeout: 15_000 });
    await expect(preview).toContainText("Zweiter Absatz.");
    await expect(preview).toContainText("Dritter Absatz.");
  });
});
