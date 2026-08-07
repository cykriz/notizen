import { SHARE_EXPIRY_LABELS } from './constants';
import { formatDateTime } from './utils';

export function formatExpiresAt(expiresAt: string | null): string {
  if (expiresAt === null) {
    return SHARE_EXPIRY_LABELS.never;
  }

  return formatDateTime(expiresAt);
}

export function buildShareUrl(origin: string, token: string): string {
  return `${origin}/share/${token}`;
}
