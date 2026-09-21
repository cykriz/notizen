'use client';

import { FilePlus, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { NoteCommandItem } from '@/components/NoteCommandItem';
import { NOTE_CREATE_GROUP_LABEL, noteCreateLabel } from '@/lib/paletteConstants';
import type { NoteSummary, Todo } from '@/lib/types';

interface CommandPaletteNotesProps {
  notes: NoteSummary[];
  todos: Todo[];
  /** The title an ordinary query would create, or null when nothing was typed — see
   *  `noteCreateCandidate`. */
  createTitle: string | null;
  /** The sidebar's current folder, shown on the create row so the target is visible. */
  folderPath: string;
  onSelectNote: (id: string) => void;
  onSelectTodo: () => void;
  onCreate: (title: string) => void;
}

/**
 * The palette's ordinary mode: notes, todos, then the create row.
 *
 * The create row sits LAST on purpose, the same way it does in `CommandPaletteTags`. cmdk
 * preselects the first row after every query change, so Enter keeps hitting the best existing
 * note; the create row inherits the preselection exactly when nothing matched, which is when
 * the note genuinely does not exist yet. It stays offered even on an exact title hit — unlike a
 * tag path, a note title is not an identity.
 */
export function CommandPaletteNotes({
  notes,
  todos,
  createTitle,
  folderPath,
  onSelectNote,
  onSelectTodo,
  onCreate,
}: CommandPaletteNotesProps) {
  return (
    <>
      {notes.length > 0 && (
        <CommandGroup heading="Notizen">
          {notes.map((note) => (
            <NoteCommandItem
              key={note.id}
              note={note}
              onSelect={() => {
                onSelectNote(note.id);
              }}
            />
          ))}
        </CommandGroup>
      )}

      {todos.length > 0 && (
        <CommandGroup heading="Aufgaben">
          {todos.map((todo) => (
            <CommandItem key={todo.id} value={todo.id} onSelect={onSelectTodo}>
              <ListChecks />
              <span className="truncate">{todo.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {/* The whole group is conditional, not just the row: with cmdk's filtering off it would
          never hide an empty group, leaving a bare heading behind. */}
      {createTitle !== null && (
        <CommandGroup heading={NOTE_CREATE_GROUP_LABEL}>
          {/* `create-note:` prefix so the value cannot collide with the note and todo ids above
              — with shouldFilter off, value is pure row identity. */}
          <CommandItem
            value={`create-note:${createTitle}`}
            onSelect={() => {
              onCreate(createTitle);
            }}
          >
            <FilePlus />
            <span className="truncate">{noteCreateLabel(createTitle)}</span>
            {folderPath !== '' && (
              <Badge variant="secondary" className="ml-auto px-1 py-0">
                {folderPath}
              </Badge>
            )}
          </CommandItem>
        </CommandGroup>
      )}
    </>
  );
}
