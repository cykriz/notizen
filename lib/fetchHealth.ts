import { HEALTH_TIMEOUT_MS } from './constants';

// The single health probe. Both hooks that need to know whether THIS server is
// reachable go through here: useOnlineStatus (polling) and useDataSync
// (before a pull). useDataSync used to carry its own copy without the timeout.
export async function fetchHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, HEALTH_TIMEOUT_MS);

    // POST bypasses service worker cache (SW only caches GET requests)
    const res = await fetch('/api/health', {
      method: 'POST',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return false;
    }

    // Verify this is actually the notizen server, not another app on the same port
    const body = (await res.json()) as { app?: string };

    return body.app === 'notizen';
  } catch {
    return false;
  }
}
