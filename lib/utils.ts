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
 * Today as `YYYY-MM-DD` in DISPLAY_TIME_ZONE, for comparing against date-only
 * `<input type="date">` values. Same zone as formatDate on purpose: deciding the
 * calendar day in the device zone while rendering it in Berlin let a due-today
 * badge read as not-yet-due for anyone travelling.
 *
 * `en-CA` is the locale whose short date format already is `YYYY-MM-DD`.
 * `now` is injectable so the zone can be asserted against fixed instants.
 */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Both arguments are date-only `YYYY-MM-DD`, which compares correctly as a string. */
export function isOverdue(dueDate: string, today = todayIso()): boolean {
  return dueDate < today;
}
