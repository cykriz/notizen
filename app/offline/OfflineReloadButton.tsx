'use client';

import { Button } from '@/components/ui/button';

export function OfflineReloadButton() {
  return (
    <Button
      variant="outline"
      onClick={() => {
        window.location.reload();
      }}
    >
      Erneut versuchen
    </Button>
  );
}
