import { test, expect } from '@playwright/test';
import { TEST_USER } from '../playwright.config';
import { NOTES_EMPTY_STATE, createNote } from './helpers';

test.describe('Smoke Tests', () => {
  test('can see the notes page when authenticated', async ({ page }) => {
    await page.goto('/notes');
    await expect(page).toHaveURL('/notes');
    await expect(page.getByText(NOTES_EMPTY_STATE)).toBeVisible();
  });

  test('corner glow overlay never intercepts input and stays below dialogs', async ({ page }) => {
    await page.goto('/notes');
    const glow = await page.evaluate(() => {
      const style = getComputedStyle(document.body, '::after');
      return { pointerEvents: style.pointerEvents, position: style.position, zIndex: Number(style.zIndex) };
    });
    expect(glow.pointerEvents).toBe('none');
    expect(glow.position).toBe('fixed');
    // 50 = the z-index of the portaled Radix layers in components/ui/ (dialog, popover, sheet)
    expect(glow.zIndex).toBeLessThan(50);
  });

  test('loading glow never intercepts input and stays hidden while idle', async ({ page }) => {
    await page.goto('/notes');
    const loader = page.locator('.ambient-loading-glow');
    await expect(loader).toHaveCSS('pointer-events', 'none');
    await expect(loader).toHaveCSS('opacity', '0');
  });

  test('loading glow stays visible after a cached note navigation settles', async ({ page }) => {
    await page.goto('/notes');
    const urlA = await createNote(page, 'Glow A', 'a');
    await createNote(page, 'Glow B', 'b');
    await page.getByRole('link', { name: 'Glow A' }).first().click();
    await page.waitForURL(urlA);
    // Cached navigations settle in milliseconds; without the hold the glow never fades in.
    // Wait just past the fade-in, well inside MIN_VISIBLE_MS.
    await page.waitForTimeout(600);
    await expect(page.locator('.ambient-loading-glow')).toHaveClass(/is-active/);
    await expect(page.locator('.ambient-loading-glow')).not.toHaveClass(/is-active/, { timeout: 3000 });
  });

  test('desktop sidebar renders above the corner glow', async ({ page }) => {
    await page.goto('/notes');
    const glowZ = await page.evaluate(() => Number(getComputedStyle(document.body, '::after').zIndex));
    const sidebarZ = await page.locator('[data-slot="sidebar"]').evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(sidebarZ).toBeGreaterThan(glowZ);
  });
});

test.describe('Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('can log in and see the notes page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(TEST_USER.username);
    await page.getByLabel('Passwort').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/notes/, { timeout: 15_000 });
    await expect(page.getByText(NOTES_EMPTY_STATE)).toBeVisible();
  });

  test('setup page redirects to login when users exist', async ({ page }) => {
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/login/);
  });
});
