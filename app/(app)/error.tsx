'use client';

import { useContext, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DataContext } from './dataContext';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const data = useContext(DataContext);
  const isOnline = data?.isOnline ?? true;

  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  const isChunkError = error.name === 'ChunkLoadError' || error.message.includes('Failed to fetch');

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-4">
        <h2 className="text-lg font-semibold">
          {isChunkError && !isOnline ? 'Keine Verbindung' : 'Etwas ist schiefgelaufen'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isChunkError && !isOnline
            ? 'Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.'
            : 'Ein unerwarteter Fehler ist aufgetreten.'}
        </p>
        <Button variant="outline" onClick={reset}>
          Erneut versuchen
        </Button>
      </div>
    </div>
  );
}
