import { SHARE_EXPIRY_LABELS } from './constants';

export function formatExpiresAt(expiresAt: string | null): string {
  if (expiresAt === null) {
    return SHARE_EXPIRY_LABELS.never;
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(expiresAt));
}

export function buildShareUrl(origin: string, token: string): string {
  return `${origin}/share/${token}`;
}
