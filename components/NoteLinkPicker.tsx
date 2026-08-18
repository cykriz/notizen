'use client';

import { useMemo, useState } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/command';
import { NoteCommandItem } from '@/components/NoteCommandItem';
import { noteSearchText, rankByQuery, sortNotesForPalette } from '@/lib/commandSearch';
import type { NoteSummary } from '@/lib/types';

interface NoteLinkPickerProps {
  notes: NoteSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (note: NoteSummary) => void;
}

/**
 * The query lives in here rather than in NoteLinkPicker on purpose: this component only exists
 * while the dialog is open, so closing it discards the search by unmounting — no reset to keep
 * in sync with `open`, which the parent owns and can flip without going through onOpenChange.
 *
 * With cmdk's filtering off (the Command default), the query has to be tracked somewhere:
 * without it there is nothing to rank against and the picker would just list the first
 * COMMAND_RESULT_LIMIT notes.
 */
function NoteLinkPickerContent({ notes, onOpenChange, onSelect }: Omit<NoteLinkPickerProps, 'open'>) {
  const [query, setQuery] = useState('');

  const sortedNotes = useMemo(() => sortNotesForPalette(notes), [notes]);
  const visibleNotes = useMemo(() => rankByQuery(sortedNotes, query, noteSearchText), [sortedNotes, query]);

  return (
    <>
      <CommandInput placeholder="Notiz suchen…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Keine Notizen gefunden.</CommandEmpty>
        {visibleNotes.length > 0 && (
          <CommandGroup heading="Notizen">
            {visibleNotes.map((note) => (
              <NoteCommandItem
                key={note.id}
                note={note}
                onSelect={() => {
                  onSelect(note);
                  onOpenChange(false);
                }}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );
}

export function NoteLinkPicker({ notes, open, onOpenChange, onSelect }: NoteLinkPickerProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Notiz verknüpfen"
      description="Suche nach einer Notiz zum Verknüpfen…"
      showCloseButton={false}
    >
      <NoteLinkPickerContent notes={notes} onOpenChange={onOpenChange} onSelect={onSelect} />
    </CommandDialog>
  );
}
