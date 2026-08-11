import { SW_MSG_CLEAR_AUTH_CACHES } from '@/lib/constants';
import { postToServiceWorker } from '@/lib/swMessage';

/**
 * Synchronous on purpose: the LogoutButton calls this from an onClick that
 * immediately submits a form, so the document starts tearing down right away —
 * an awaited `serviceWorker.ready` might never resume and the wipe would be
 * lost entirely.
 *
 * The price is that `controller` is null on a page the SW does not yet control
 * (first visit: `clients.claim()` waits on activate, which waits on the
 * install-time precache), and the post then goes nowhere. clearSwCachesWhenReady
 * below closes that gap from the page the logout lands on.
 */
export function clearSwCaches(): void {
  if (typeof navigator === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.controller?.postMessage({ type: SW_MSG_CLEAR_AUTH_CACHES });
}

/**
 * Catch-up variant for pages with no navigation pending (the /login mount).
 * Addresses the active worker via `serviceWorker.ready`, so it lands even when
 * the page is not controlled — which is exactly the case the synchronous
 * version misses. Idempotent: the SW purge runs inside waitUntil either way.
 */
export async function clearSwCachesWhenReady(): Promise<void> {
  await postToServiceWorker({ type: SW_MSG_CLEAR_AUTH_CACHES });
}
