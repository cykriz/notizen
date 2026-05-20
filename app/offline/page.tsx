import type { Metadata } from 'next';
import { OfflineReloadButton } from './OfflineReloadButton';

export const metadata: Metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold">Keine Verbindung</h1>
        <p className="text-sm text-muted-foreground">
          Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.
        </p>
        <OfflineReloadButton />
      </div>
    </div>
  );
}
