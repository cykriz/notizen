'use client';

export default function OfflinePage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-4">
        <h2 className="text-lg font-semibold">Keine Verbindung</h2>
        <p className="text-sm text-muted-foreground">
          Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.
        </p>
        <button
          onClick={() => {
            location.reload();
          }}
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
