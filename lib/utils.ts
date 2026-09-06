import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DISPLAY_TIME_ZONE } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The zone is pinned, not left to the runtime: the container sets no `TZ` and so
 * renders in UTC while the browser renders in local time, which made a timestamp
 * between 22:00Z and midnight show the previous day in the server HTML.
 * Every user-facing date in the app goes through this function or formatDateTime.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE,
  });
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * Newest first, for any record carrying an ISO `updatedAt`. Shared so the todo and
 * note listings and the WIP surplus rule cannot drift apart on what "newest" means.
 */
export function byUpdatedAtDesc(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
