import fs from 'fs/promises';
import path from 'path';
import type { UserSettings } from './types';
import {
  SETTINGS_FILE,
  DEFAULT_TRASH_RETENTION_DAYS,
  MIN_TRASH_RETENTION_DAYS,
  MAX_TRASH_RETENTION_DAYS,
} from './constants';
import { ensureDir } from './fsHelpers';

function settingsPath(root: string): string {
  return path.join(root, SETTINGS_FILE);
}

function clampRetention(days: number): number {
  if (!Number.isFinite(days)) {
    return DEFAULT_TRASH_RETENTION_DAYS;
  }

  return Math.min(MAX_TRASH_RETENTION_DAYS, Math.max(MIN_TRASH_RETENTION_DAYS, Math.round(days)));
}

export async function getUserSettings(root: string): Promise<UserSettings> {
  try {
    const parsed = JSON.parse(await fs.readFile(settingsPath(root), 'utf-8')) as Partial<UserSettings>;
    return {
      retentionDays:
        typeof parsed.retentionDays === 'number'
          ? clampRetention(parsed.retentionDays)
          : DEFAULT_TRASH_RETENTION_DAYS,
    };
  } catch {
    return { retentionDays: DEFAULT_TRASH_RETENTION_DAYS };
  }
}

export async function updateUserSettings(
  root: string,
  input: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getUserSettings(root);
  const next: UserSettings = {
    retentionDays:
      input.retentionDays !== undefined ? clampRetention(input.retentionDays) : current.retentionDays,
  };
  await ensureDir(root);
  await fs.writeFile(settingsPath(root), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
