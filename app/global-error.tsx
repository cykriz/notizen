'use client';

// Minimal top-level error boundary — no external imports so its chunk is
// always available (bundled with the root layout). Catches errors that
// bypass route-level error.tsx (e.g. missing chunks while offline).
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100svh' }}>
          <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '420px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              {isOffline ? 'Keine Verbindung' : 'Etwas ist schiefgelaufen'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: '1.5rem' }}>
              {isOffline
                ? 'Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.'
                : 'Ein unerwarteter Fehler ist aufgetreten.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.25rem',
                border: '1px solid #ddd',
                borderRadius: '0.375rem',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
