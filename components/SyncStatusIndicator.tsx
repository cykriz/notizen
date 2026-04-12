'use client';

import { useData } from '@/app/(app)/DataProvider';
import { Button } from '@/components/ui/button';
import { Cloud, CloudAlert, CloudOff, CloudUpload, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function SyncStatusIndicator() {
  const { isOnline, hasPendingSync, failedSyncCount, clearFailedSync, refreshFromServer } = useData();
  const [syncing, setSyncing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    setRefreshError(false);
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
    }

    try {
      await refreshFromServer();
    } catch {
      setRefreshError(true);
      errorTimer.current = setTimeout(() => {
        setRefreshError(false);
      }, 3000);
    } finally {
      setSyncing(false);
    }
  }, [refreshFromServer]);

  function renderIcon() {
    if (syncing) {
      return <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground animate-spin direction-reverse" />;
    }

    if (refreshError) {
      return <CloudAlert className="h-3.5 w-3.5 text-destructive" />;
    }

    return <Cloud className="h-3.5 w-3.5 text-muted-foreground" />;
  }

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
    <Button
      variant="ghost"
      size="icon"
      disabled={syncing}
      onClick={handleRefresh}
      aria-label="Manuell synchronisieren"
      title={refreshError ? 'Aktualisierung fehlgeschlagen' : 'Synchronisiert — klicken zum Aktualisieren'}
      className="h-auto w-auto p-0"
    >
      {renderIcon()}
    </Button>
  );
}
