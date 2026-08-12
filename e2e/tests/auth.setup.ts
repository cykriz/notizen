import { test as setup, expect } from '@playwright/test';
import { TEST_USER, STORAGE_STATE } from '../playwright.config';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername').fill(TEST_USER.username);
  await page.getByLabel('Passwort').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page).toHaveURL(/\/notes/, { timeout: 15_000 });
  await page.context().storageState({ path: STORAGE_STATE });
});
