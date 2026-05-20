import { SW_MSG_CLEAR_AUTH_CACHES } from '@/lib/constants';

export function clearSwCaches(): void {
  if (typeof navigator === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.controller?.postMessage({ type: SW_MSG_CLEAR_AUTH_CACHES });
}
