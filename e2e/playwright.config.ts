import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Stabilize the notes-root path across Playwright processes: the runner and
// each worker all evaluate this file, but have different PIDs. Storing the
// computed path in an env var lets workers inherit the runner's value.
const testNotesRoot =
  process.env.NOTIZEN_E2E_NOTES_ROOT ??
  path.join(process.cwd(), `.test-notes-pw-${process.pid}`);
process.env.NOTIZEN_E2E_NOTES_ROOT = testNotesRoot;

export const TEST_NOTES_ROOT = testNotesRoot;
export const TEST_USER = { username: 'testuser', password: 'testpass123' };
export const TEST_PORT = 3100;
export const STORAGE_STATE = path.join(__dirname, '.auth', 'user.json');

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  outputDir: './test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 60_000,

  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
      dependencies: ['setup'],
    },
    // Uncomment to test additional browsers:
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: {
    command: `bun run scripts/manage-users.ts add ${TEST_USER.username} ${TEST_USER.password} || true; bun --bun next build && bun --bun next start --port ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}`,
    cwd: path.join(__dirname, '..'),
    reuseExistingServer: !isCI,
    env: { ...process.env, NOTES_ROOT: testNotesRoot },
    timeout: 90_000,
  },
});
