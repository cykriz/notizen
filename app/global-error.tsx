'use client';

import { useEffect } from 'react';

// Root-layout error boundary. Must work when other chunks fail to load, so no @/... imports (including lib/constants strings — duplicated on purpose), own <html><body>, inline colors only.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('GlobalError fired:', { name: error.name, message: error.message, stack: error.stack });
  }, [error]);

  // Detect chunk-load failures directly. navigator.onLine alone misses the
  // DevTools "Offline" SW toggle (which leaves navigator.onLine === true)
  // and the case where the (app)/error.tsx boundary itself failed to load.
  const isChunkError = error.name === 'ChunkLoadError' || error.message.includes('Failed to fetch');
  const isOffline = isChunkError || (typeof navigator !== 'undefined' && !navigator.onLine);

  return (
    <html lang="de">
      <body className="m-0 font-sans antialiased">
        <div className="flex items-center justify-center min-h-svh">
          <div className="text-center p-8 max-w-105">
            <h2 className="text-xl mb-2">{isOffline ? 'Keine Verbindung' : 'Etwas ist schiefgelaufen'}</h2>
            <p className="text-sm text-[#888] mb-6">
              {isOffline
                ? 'Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.'
                : 'Ein unerwarteter Fehler ist aufgetreten.'}
            </p>
            <button
              onClick={reset}
              className="px-5 py-2 border border-[#ddd] rounded-md bg-transparent cursor-pointer text-sm"
            >
              Erneut versuchen
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional: a full-page navigation works even when the (app) chunk is missing, which is the scenario this boundary exists for */}
            <a href="/notes" className="mt-3 inline-block text-sm text-[#888] underline">
              Zu den Notizen
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
