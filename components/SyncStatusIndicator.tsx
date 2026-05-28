'use client';

import { ClearFailedSyncDialog } from '@/app/(app)/ClearFailedSyncDialog';
import { useData } from '@/app/(app)/dataContext';
import { Button } from '@/components/ui/button';
import { Cloud, CloudAlert, CloudOff, CloudUpload, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function SyncStatusIndicator() {
  const { isOnline, hasPendingSync, failedSyncCount, refreshFromServer } = useData();
  const [syncing, setSyncing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
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

  // Dialog is rendered alongside every branch so its close animation completes
  // even after failedSyncCount drops to 0 and the indicator switches branches.
  const dialog = (
    <ClearFailedSyncDialog
      open={clearOpen}
      onOpenChange={setClearOpen}
      onCleared={() => {
        // header has no current sidebar path to reset
      }}
    />
  );

  if (!isOnline) {
    return (
      <>
        <span title="Offline">
          <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        {dialog}
      </>
    );
  }

  if (failedSyncCount > 0) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setClearOpen(true);
          }}
          aria-label="Fehlgeschlagene Synchronisierungen verwerfen"
          title={`${failedSyncCount.toString()} fehlgeschlagene Synchronisierungen — klicken zum Verwerfen`}
          className="h-auto w-auto p-0"
        >
          <CloudAlert className="h-3.5 w-3.5 text-destructive" />
        </Button>
        {dialog}
      </>
    );
  }

  if (hasPendingSync) {
    return (
      <>
        <span title="Synchronisiere…">
          <CloudUpload className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
        </span>
        {dialog}
      </>
    );
  }

  return (
    <>
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
      {dialog}
    </>
  );
}
