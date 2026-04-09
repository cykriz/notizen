'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';

const isProduction = process.env.NODE_ENV === 'production';

function SwRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (!isProduction) {
      // Dev mode: unregister any lingering SW
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          void reg.unregister();
        }
      });
      return;
    }

    // Production: register with root scope
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
