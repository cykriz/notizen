'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Share } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { sharedNotesStore } from './sharedNotesStore';
import { SharedNotesDialog } from './SharedNotesDialog';

interface SharedNotesEntryProps {
  hidden: boolean;
}

export function SharedNotesEntry({ hidden }: SharedNotesEntryProps) {
  const shares = useSyncExternalStore(
    sharedNotesStore.subscribe,
    sharedNotesStore.getSnapshot,
    sharedNotesStore.getServerSnapshot,
  );
  const { isOnline } = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [prevHidden, setPrevHidden] = useState(hidden);
  const wasOnlineRef = useRef(isOnline);

  if (prevHidden !== hidden) {
    setPrevHidden(hidden);
    if (hidden) {
      setOpen(false);
    }
  }

  // Refresh on mount (if not yet hydrated) and on offline→online transitions —
  // skip steady-state online renders where someone else already populated the
  // store. wasOnlineRef is seeded from `isOnline`, so on the first effect run
  // `wasOnline === isOnline`; the `shares === null` branch is what catches the
  // initial-mount-while-online case.
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!isOnline) {
      return;
    }

    if (!wasOnline || shares === null) {
      void sharedNotesStore.refresh();
    }
  }, [isOnline, shares]);

  // Keep the dialog mounted while it's open so revoking the last share
  // doesn't cut its close animation short. After close, hold the mount
  // for ~200ms (matches Radix's exit animation) so the dialog can fade
  // out cleanly when this entry would otherwise unmount immediately.
  const visible = !hidden && isOnline && shares !== null && shares.length > 0;
  const [keepDialogMounted, setKeepDialogMounted] = useState(open);
  if (open && !keepDialogMounted) {
    setKeepDialogMounted(true);
  }

  useEffect(() => {
    if (open) {
      return;
    }

    const t = setTimeout(() => {
      setKeepDialogMounted(false);
    }, 200);
    return () => {
      clearTimeout(t);
    };
  }, [open]);

  if (!visible && !keepDialogMounted) {
    return null;
  }

  return (
    <>
      {visible && (
        <>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setOpen(true);
                }}
                className="h-auto text-muted-foreground"
                title="Geteilte Notizen"
              >
                <Share className="shrink-0" />
                <span className="truncate">Geteilte Notizen</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{shares.length}</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
          <Separator className="mx-2" />
        </>
      )}
      <SharedNotesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
