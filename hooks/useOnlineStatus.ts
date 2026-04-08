import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SYNC_HEALTH_POLL_MS } from '@/lib/constants';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

// Returns true on server to match initial client render — avoids hydration mismatch.
// Real status is determined async via fetchHealth() after mount.
function getServerSnapshot() {
  return true;
}

async function fetchHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

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

export function useOnlineStatus() {
  const browserOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [serverReachable, setServerReachable] = useState(true);
  const serverReachableRef = useRef(serverReachable);

  useEffect(() => {
    serverReachableRef.current = serverReachable;
  }, [serverReachable]);

  useEffect(() => {
    const check = () => {
      void fetchHealth().then(setServerReachable);
    };

    // Check once on mount
    check();

    // Re-check whenever the browser thinks it's back online
    window.addEventListener('online', check);

    // Re-check when tab becomes visible (catches server restart while tab was in background)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // Poll for reconnections that don't fire the 'online' event
    const interval = setInterval(() => {
      if (!document.hidden && navigator.onLine && !serverReachableRef.current) {
        check();
      }
    }, SYNC_HEALTH_POLL_MS);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return { isOnline: browserOnline && serverReachable };
}
