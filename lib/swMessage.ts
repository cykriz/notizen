// The one place the page talks to the service worker.
//
// Addressing goes through `navigator.serviceWorker.ready` → `registration.active`
// rather than `navigator.serviceWorker.controller`: `controller` is null on the
// page that just installed the SW — exactly the first load after a deploy, when
// the build-versioned caches are empty and the repair matters most. `ready`
// resolves for an uncontrolled page too, and an active worker receives messages
// whether or not it controls the sender.
//
// Exception: lib/clearSwCaches.ts deliberately stays on `controller` — see the
// note there.

// `ready` never settles when no SW is registered (dev mode unregisters it,
// /share/ never registers one), so every await needs an escape hatch.
const READY_TIMEOUT_MS = 10_000;

function swSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

async function activeWorker(): Promise<ServiceWorker | null> {
  if (!swSupported()) {
    return null;
  }

  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(resolve, READY_TIMEOUT_MS, null)),
  ]);
  return registration?.active ?? null;
}

/** Fire-and-forget message to the active SW. No-op when there is none. */
export async function postToServiceWorker(message: unknown): Promise<void> {
  (await activeWorker())?.postMessage(message);
}

/**
 * Send a message and wait for the SW's answer over a MessageChannel.
 * Resolves null when there is no active worker or the answer times out — a
 * missing report must never block or throw in the render path.
 */
export async function requestFromServiceWorker<T>(
  message: unknown,
  timeoutMs: number,
): Promise<T | null> {
  const worker = await activeWorker();
  if (!worker) {
    return null;
  }

  return await new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    const finish = (value: T | null) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => {
      finish(null);
    }, timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<T | null>) => {
      finish(event.data ?? null);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Defer work to idle so SW fetches don't contend with the user's own requests. */
export function runWhenIdle(fn: () => void): void {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn);
  } else {
    setTimeout(fn, 1500);
  }
}
