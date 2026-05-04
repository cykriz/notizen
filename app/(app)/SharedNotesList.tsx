'use client';

import { useMemo } from 'react';
import { Check, Copy, ExternalLink, Link2Off, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatExpiresAt } from '@/lib/shareFormat';
import type { UserShareRecord } from '@/lib/shareTypes';
import type { NoteSummary } from '@/lib/types';

const FALLBACK_TITLE = 'Notiz (gelöscht oder nicht synchronisiert)';

interface SharedNotesListProps {
  shares: UserShareRecord[] | null;
  notes: NoteSummary[];
  copiedToken: string | null;
  revokingIds: ReadonlySet<string>;
  onCopy: (token: string) => void;
  onOpen: (noteId: string) => void;
  onRevoke: (noteId: string) => void;
}

export function SharedNotesList({
  shares,
  notes,
  copiedToken,
  revokingIds,
  onCopy,
  onOpen,
  onRevoke,
}: SharedNotesListProps) {
  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  if (shares === null) {
    return (
      <>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </>
    );
  }

  if (shares.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Du hast keine Notizen geteilt.
      </p>
    );
  }

  return (
    <>
      {shares.map((share) => {
        const note = notesById.get(share.noteId);
        const title = note?.title ?? FALLBACK_TITLE;
        const isRevoking = revokingIds.has(share.noteId);
        const isCopied = copiedToken === share.token;

        return (
          <div
            key={share.token}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{title}</span>
              <span className="text-xs text-muted-foreground">
                Gültig bis: {formatExpiresAt(share.expiresAt)}
              </span>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                onCopy(share.token);
              }}
              aria-label="Link kopieren"
              title="Link kopieren"
            >
              {isCopied ? <Check /> : <Copy />}
            </Button>
            {note ? (
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  onOpen(share.noteId);
                }}
                aria-label="Notiz öffnen"
                title="Notiz öffnen"
              >
                <ExternalLink />
              </Button>
            ) : null}
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                onRevoke(share.noteId);
              }}
              disabled={isRevoking}
              aria-label="Widerrufen"
              title="Widerrufen"
            >
              {isRevoking ? <Loader2 className="animate-spin" /> : <Link2Off />}
            </Button>
          </div>
        );
      })}
    </>
  );
}
