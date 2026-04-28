'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ShareError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Share error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="text-sm text-muted-foreground">
          Die geteilte Notiz konnte nicht geladen werden.
        </p>
        <Button variant="outline" onClick={reset}>
          Erneut versuchen
        </Button>
      </div>
    </div>
  );
}
