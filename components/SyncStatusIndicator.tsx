'use client';

import { FailedSyncDialog } from '@/app/(app)/FailedSyncDialog';
import { useData } from '@/app/(app)/dataContext';
import { Button } from '@/components/ui/button';
import {
  FAILED_SYNC_OPEN_LABEL,
  failedSyncIndicatorTitle,
} from '@/lib/failedSyncConstants';
import {
  SYNC_ERROR_TITLE,
  SYNC_IDLE_LABEL,
  SYNC_IDLE_TITLE,
  SYNC_OFFLINE_TITLE,
  SYNC_PENDING_LABEL,
  SYNC_PENDING_TITLE,
} from '@/lib/syncStatusConstants';
import { Cloud, CloudAlert, CloudOff, CloudUpload, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function SyncStatusIndicator() {
  const { isOnline, hasPendingSync, failedSyncCount, syncNow } = useData();
  const [syncing, setSyncing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
      }
    };
  }, []);

  // One handler for both interactive branches: syncNow pushes the outbox first
  // and then pulls, so an empty queue makes it a plain refresh.
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setRefreshError(false);
    if (errorTimer.current) {
      clearTimeout(errorTimer.current);
    }

    try {
      await syncNow();
    } catch {
      setRefreshError(true);
      errorTimer.current = setTimeout(() => {
        setRefreshError(false);
      }, 3000);
    } finally {
      setSyncing(false);
    }
  }, [syncNow]);

  function buttonTitle() {
    if (refreshError) {
      return SYNC_ERROR_TITLE;
    }

    return hasPendingSync ? SYNC_PENDING_TITLE : SYNC_IDLE_TITLE;
  }

  // The one place the icon precedence lives: in progress beats error beats
  // unsent work beats resting.
  function renderIcon() {
    if (syncing) {
      return <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground animate-spin direction-reverse" />;
    }

    if (refreshError) {
      return <CloudAlert className="h-3.5 w-3.5 text-destructive" />;
    }

    if (hasPendingSync) {
      return <CloudUpload className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />;
    }

    return <Cloud className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  // Dialog is rendered alongside every branch so its close animation completes
  // even after failedSyncCount drops to 0 and the indicator switches branches.
  const dialog = (
    <FailedSyncDialog
      open={failedOpen}
      onOpenChange={setFailedOpen}
      onEmptied={() => {
        // header has no current sidebar path to reset
      }}
    />
  );

  // Failed entries win over the offline branch. The old order returned an inert
  // CloudOff first, hiding the unsynced changes exactly when inspecting them
  // matters most — the dialog is localStorage-only and works fully offline.
  // One icon carries both states (a second one would crowd the header strip).
  if (failedSyncCount > 0) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setFailedOpen(true);
          }}
          aria-label={FAILED_SYNC_OPEN_LABEL}
          title={failedSyncIndicatorTitle(failedSyncCount, isOnline)}
          className="h-auto w-auto p-0"
        >
          {isOnline ? (
            <CloudAlert className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <CloudOff className="h-3.5 w-3.5 text-destructive" />
          )}
        </Button>
        {dialog}
      </>
    );
  }

  if (!isOnline) {
    return (
      <>
        <span title={SYNC_OFFLINE_TITLE}>
          <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        {dialog}
      </>
    );
  }

  // Pending and idle share one button — they differ only in label, title and the
  // resting icon. The pending branch used to be an inert <span>, i.e. the icon
  // stopped being clickable exactly when there was unsent work.
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        disabled={syncing}
        onClick={handleSync}
        aria-label={hasPendingSync ? SYNC_PENDING_LABEL : SYNC_IDLE_LABEL}
        title={buttonTitle()}
        className="h-auto w-auto p-0"
      >
        {renderIcon()}
      </Button>
      {dialog}
    </>
  );
}
