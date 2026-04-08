import { test, expect } from "@playwright/test";
import { TEST_USER } from "../playwright.config";

test.describe("Smoke Tests", () => {
  test("can see the notes page when authenticated", async ({ page }) => {
    await page.goto("/notes");
    await expect(page).toHaveURL("/notes");
    await expect(
      page.getByText("Wähle eine Notiz aus, um zu beginnen"),
    ).toBeVisible();
  });
});

test.describe("Unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("can log in and see the notes page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Benutzername").fill(TEST_USER.username);
    await page.getByLabel("Passwort").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/notes/, { timeout: 15_000 });
    await expect(
      page.getByText("Wähle eine Notiz aus, um zu beginnen"),
    ).toBeVisible();
  });

  test("setup page redirects to login when users exist", async ({ page }) => {
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login/);
  });
});
