import { z } from 'zod';
import { SHARE_EXPIRY_PRESETS, type ShareExpiryPreset } from './constants';

export const PRESET_KEYS = Object.keys(SHARE_EXPIRY_PRESETS) as [
  ShareExpiryPreset,
  ...ShareExpiryPreset[],
];
export const SharePresetSchema = z.enum(PRESET_KEYS);

export interface ShareRecord {
  token: string;
  preset: ShareExpiryPreset;
  createdAt: string;
  expiresAt: string | null;
}

export interface ShareLookup {
  username: string;
  noteId: string;
  expiresAt: string | null;
}
