'use client';

import { Cloud, CloudAlert, CloudOff, CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useData } from '@/app/(app)/DataProvider';

export function SyncStatusIndicator() {
  const { isOnline, hasPendingSync, failedSyncCount, clearFailedSync } = useData();

  if (!isOnline) {
    return (
      <span title="Offline">
        <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    );
  }

  if (failedSyncCount > 0) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={clearFailedSync}
        aria-label="Fehlgeschlagene Synchronisierungen verwerfen"
        title={`${failedSyncCount.toString()} fehlgeschlagene Synchronisierungen — klicken zum Verwerfen`}
        className="h-auto w-auto p-0"
      >
        <CloudAlert className="h-3.5 w-3.5 text-destructive" />
      </Button>
    );
  }

  if (hasPendingSync) {
    return (
      <span title="Synchronisiere…">
        <CloudUpload className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
      </span>
    );
  }

  return (
    <span title="Synchronisiert">
      <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}
