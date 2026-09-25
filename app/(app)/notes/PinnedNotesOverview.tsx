'use client';

import Link from 'next/link';
import { Pin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { NoteTagBadges } from '@/components/NoteTagBadges';
import { formatDate } from '@/lib/utils';
import { PINNED_LABEL } from '@/lib/constants';
import { useData } from '../dataContext';
import { usePinnedNotes } from '../usePinnedNotes';
import { LinkLoadingReporter } from '../LinkLoadingReporter';

/** Quick-open tiles for pinned notes on the empty `/notes` page. Reads the merged client list,
 *  so it works offline; renders nothing without pins, leaving the plain empty state. */
export function PinnedNotesOverview() {
  const { notes } = useData();
  const pinnedNotes = usePinnedNotes(notes);

  if (pinnedNotes.length === 0) {
    return null;
  }

  return (
    <section aria-label={PINNED_LABEL} className="flex w-full max-w-3xl flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Pin className="size-4" /> {PINNED_LABEL}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pinnedNotes.map((note) => (
          <li key={note.id} data-testid="pinned-tile">
            <Link href={`/notes/${note.id}`} className="block h-full rounded-xl">
              <LinkLoadingReporter />
              <Card className="h-full gap-1 px-4 py-3 transition-colors hover:bg-accent">
                <span className="truncate font-medium">{note.title}</span>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{formatDate(note.updatedAt)}</span>
                  <NoteTagBadges tags={note.tags} />
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
