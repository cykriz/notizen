import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SYNC_HEALTH_POLL_MS } from '@/lib/constants';
import { fetchHealth } from '@/lib/fetchHealth';

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
