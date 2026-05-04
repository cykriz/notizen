import { test, expect, type Page } from "@playwright/test";
import {
  createNote,
  deleteAllNotes,
  deleteAllShares,
  readShareRegistry,
  setShareExpiry,
} from "./helpers";

async function createShareViaUI(
  page: Page,
  preset?: "1 Tag" | "1 Woche" | "1 Monat" | "Unbegrenzt",
): Promise<{ url: string; token: string }> {
  await page.getByRole("button", { name: "Notiz teilen" }).click();

  if (preset) {
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: preset }).click();
  }

  await page.getByRole("button", { name: "Teilen-Link erstellen" }).click();
  const input = page.locator('input[readonly][value^="http"]').first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  const url = await input.inputValue();
  const match = /\/share\/([A-Za-z0-9_-]{43})$/.exec(url);
  if (!match) {
    throw new Error(`Unexpected share URL: ${url}`);
  }
  return { url, token: match[1] };
}

test.describe("Share note", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/notes");
    await deleteAllNotes(page);
    await deleteAllShares();
  });

  test("create → public access → revoke", async ({ page, browser }) => {
    await createNote(page, "Geteilte Notiz", "# Überschrift\n\nHallo Welt.");
    const { url } = await createShareViaUI(page);

    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const anonPage = await anonContext.newPage();
    const response = await anonPage.goto(url);
    expect(response?.status()).toBe(200);

    await expect(anonPage.getByRole("heading", { level: 1, name: "Geteilte Notiz" })).toBeVisible();
    await expect(anonPage.getByText("Nur-Lese-Ansicht")).toBeVisible();
    await expect(anonPage.locator('[data-slot="sidebar"]')).toHaveCount(0);

    const robots = await anonPage.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toMatch(/noindex/i);

    await page.getByRole("button", { name: "Widerrufen" }).click();
    await expect(page.getByRole("button", { name: "Teilen-Link erstellen" })).toBeVisible();

    // Use a fresh request instead of anonPage.reload() — Chromium's bfcache
    // can serve the prior 200 even with `must-revalidate`, making the
    // assertion flaky.
    const revokedResponse = await anonContext.request.get(url);
    expect(revokedResponse.status()).toBe(404);

    await anonContext.close();
  });

  test("default expiry preset is 1 Woche", async ({ page }) => {
    await createNote(page, "Presets", "Inhalt");
    const { token } = await createShareViaUI(page);
    const registry = await readShareRegistry();
    const entry = registry[token];
    expect(entry).toBeDefined();
    expect(entry.expiresAt).not.toBeNull();
    const delta = new Date(entry.expiresAt!).getTime() - Date.now();
    expect(delta).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(delta).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  test("custom expiry preset '1 Tag' respected", async ({ page }) => {
    await createNote(page, "Eintag", "Inhalt");
    const { token } = await createShareViaUI(page, "1 Tag");
    const registry = await readShareRegistry();
    const entry = registry[token];
    expect(entry.expiresAt).not.toBeNull();
    const delta = new Date(entry.expiresAt!).getTime() - Date.now();
    expect(delta).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(delta).toBeLessThan(25 * 60 * 60 * 1000);
  });

  test("expired share returns 404", async ({ page, browser }) => {
    await createNote(page, "Ablauf", "# Titel\n\nInhalt");
    const { url, token } = await createShareViaUI(page);

    await setShareExpiry(token, new Date(Date.now() - 60_000).toISOString());

    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const anonPage = await anonContext.newPage();
    const response = await anonPage.goto(url);
    expect(response?.status()).toBe(404);
    await anonContext.close();
  });

  test("note with attachment: image reachable via share link, unrelated attId 404s", async ({
    page,
    browser,
  }) => {
    await createNote(page, "Mit Bild", "Platzhalter");
    const noteUrl = page.url();
    const noteId = /\/notes\/([^/?#]+)/.exec(noteUrl)![1];

    const pngBuffer = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000000500010d0a2db40000000049454e44ae426082",
      "hex",
    );
    const uploadRes = await page.request.post(`/api/notes/${noteId}/attachments`, {
      multipart: {
        file: { name: "dot.png", mimeType: "image/png", buffer: pngBuffer },
      },
    });
    expect(uploadRes.ok()).toBe(true);
    const att = (await uploadRes.json()) as { id: string };

    const { url: shareUrl, token } = await createShareViaUI(page);

    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });

    const imgRes = await anonContext.request.get(
      `/share/${token}/attachments/${att.id}`,
    );
    expect(imgRes.status()).toBe(200);
    expect(imgRes.headers()["content-type"]).toContain("image/png");
    expect(imgRes.headers()["content-disposition"]).toContain("inline");

    const bogusRes = await anonContext.request.get(
      `/share/${token}/attachments/doesnotexist`,
    );
    expect(bogusRes.status()).toBe(404);

    const pageRes = await anonContext.request.get(shareUrl);
    expect(pageRes.status()).toBe(200);

    await anonContext.close();
  });

  test("raw HTML in shared note is escaped, not executed", async ({ page, browser }) => {
    await createNote(
      page,
      "XSS",
      'Vor dem Skript\n\n<script>window.__xssExecuted = true;</script>\n\nNach dem Skript\n\n[click](javascript:window.__xssLink=true)\n\n![x](javascript:window.__xssImg=true)',
    );
    const { url } = await createShareViaUI(page);

    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(url);
    await expect(anonPage.getByText("Nur-Lese-Ansicht")).toBeVisible();

    const executed = await anonPage.evaluate(
      () => (window as unknown as { __xssExecuted?: boolean }).__xssExecuted === true,
    );
    expect(executed).toBe(false);

    const scriptCount = await anonPage.locator('main script, article script, .wmde-markdown script').count();
    expect(scriptCount).toBe(0);

    const jsLinkCount = await anonPage.locator('a[href^="javascript:"]').count();
    expect(jsLinkCount).toBe(0);
    const jsImgCount = await anonPage.locator('img[src^="javascript:"]').count();
    expect(jsImgCount).toBe(0);

    await anonContext.close();
  });

  test("unauthenticated proxy allows /share/, still blocks /notes", async ({ page, browser }) => {
    await createNote(page, "Proxy Check", "Inhalt");
    const { url } = await createShareViaUI(page);

    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const anonPage = await anonContext.newPage();

    const shareResp = await anonPage.goto(url);
    expect(shareResp?.status()).toBe(200);
    expect(anonPage.url()).toContain("/share/");

    await anonPage.goto("/notes");
    await expect(anonPage).toHaveURL(/\/login/);

    await anonContext.close();
  });

  test("sidebar entry lists active shares; revoke from dialog clears registry", async ({ page }) => {
    await createNote(page, "Sidebar-Eintrag", "Inhalt");
    const { token } = await createShareViaUI(page);

    // Dismiss the share popover so it doesn't intercept sidebar clicks.
    await page.keyboard.press("Escape");

    const entry = page.getByRole("button", { name: "Geteilte Notizen" });
    await expect(entry).toBeVisible({ timeout: 5_000 });
    const entryBadge = page
      .locator('[data-slot="sidebar-menu-item"]')
      .filter({ has: entry })
      .locator('[data-slot="sidebar-menu-badge"]');
    await expect(entryBadge).toHaveText("1");

    await entry.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Geteilte Notizen" })).toBeVisible();
    await expect(dialog.getByText("Sidebar-Eintrag")).toBeVisible();

    await dialog.getByRole("button", { name: "Widerrufen" }).click();
    await expect(dialog.getByText("Du hast keine Notizen geteilt.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(entry).toHaveCount(0);

    const registry = await readShareRegistry();
    expect(registry[token]).toBeUndefined();
  });

  test("share page response carries Cache-Control: must-revalidate", async ({ page, browser }) => {
    await createNote(page, "Cache Header", "Inhalt");
    const { url } = await createShareViaUI(page);

    const anonContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const resp = await anonContext.request.get(url);
    expect(resp.status()).toBe(200);
    const cacheControl = resp.headers()["cache-control"] ?? "";
    expect(cacheControl).toMatch(/must-revalidate/);
    expect(cacheControl).toMatch(/private/);

    await anonContext.close();
  });
});
