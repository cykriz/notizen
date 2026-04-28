'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { SHARE_PATH_PREFIX } from '@/lib/constants';

const isProduction = process.env.NODE_ENV === 'production';

function SwRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (!isProduction) {
      // Dev mode: unregister any lingering SW so HMR doesn't serve stale assets.
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          void reg.unregister();
        }
      });
      return;
    }

    // Anonymous viewers landing directly on a share URL must never install
    // a service worker. Subsequent navigations away from /share/ in the same
    // tab won't register either, but those visitors are expected to open a
    // fresh tab anyway.
    if (window.location.pathname.startsWith(SHARE_PATH_PREFIX)) {
      return;
    }

    void navigator.serviceWorker.register('/serwist/sw.js', { scope: '/' }).catch(console.error);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SwRegistration />
      {children}
    </ThemeProvider>
  );
}
