'use client';

// Minimal top-level error boundary — no external imports so its chunk is
// always available (bundled with the root layout). Catches errors that
// bypass route-level error.tsx (e.g. missing chunks while offline).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <html lang="de">
      <body className="m-0 font-sans antialiased">
        <div className="flex items-center justify-center min-h-svh">
          <div className="text-center p-8 max-w-105">
            <h2 className="text-xl mb-2">
              {isOffline ? 'Keine Verbindung' : 'Etwas ist schiefgelaufen'}
            </h2>
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
          </div>
        </div>
      </body>
    </html>
  );
}
