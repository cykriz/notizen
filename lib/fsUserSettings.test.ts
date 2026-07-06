import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import fs from 'fs/promises';
import path from 'path';
import { getUserSettings, updateUserSettings } from './fsUserSettings';
import {
  DEFAULT_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
} from './constants';

describe('fsUserSettings', () => {
  const originalRoot = process.env.NOTES_ROOT;
  const testRoot = path.join(process.cwd(), `.test-settings-${String(Date.now())}`);

  beforeAll(() => {
    process.env.NOTES_ROOT = testRoot;
  });

  afterAll(async () => {
    if (originalRoot === undefined) {
      delete process.env.NOTES_ROOT;
    } else {
      process.env.NOTES_ROOT = originalRoot;
    }

    await fs.rm(testRoot, { recursive: true, force: true });
  });

  test('defaults when no settings file exists', async () => {
    expect((await getUserSettings(testRoot)).retentionDays).toBe(DEFAULT_TRASH_RETENTION_DAYS);
  });

  test('update persists the retention window', async () => {
    await updateUserSettings(testRoot, { retentionDays: 7 });
    expect((await getUserSettings(testRoot)).retentionDays).toBe(7);
  });

  test('clamps out-of-range values', async () => {
    expect((await updateUserSettings(testRoot, { retentionDays: 9999 })).retentionDays).toBe(
      MAX_TRASH_RETENTION_DAYS,
    );
    expect((await updateUserSettings(testRoot, { retentionDays: 0 })).retentionDays).toBe(
      MIN_TRASH_RETENTION_DAYS,
    );
  });
});
