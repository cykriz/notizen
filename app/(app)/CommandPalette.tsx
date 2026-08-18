'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { NoteCommandItem } from '@/components/NoteCommandItem';
import { noteSearchText, rankByQuery, sortNotesForPalette } from '@/lib/commandSearch';
import { listAllTagPaths } from '@/lib/tagTree';
import { TagFolderIcon } from './TagFolderIcon';
import { useReportedTransition } from './navigationLoading';
import { viewStore } from './viewStore';
import { tagNavigationStore } from './tagNavigationStore';
import type { NoteSummary, Todo } from '@/lib/types';

interface CommandPaletteProps {
  notes: NoteSummary[];
  todos: Todo[];
  /** Owned by CommandPaletteClient, together with the Mod+P binding — see the note there. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandPaletteContentProps {
  notes: NoteSummary[];
  todos: Todo[];
  onClose: () => void;
}

const todoSearchText = (todo: Todo) => todo.title;
const tagPathText = (entry: { path: string }) => entry.path;

/**
 * The query lives in here, and this component only exists while the dialog is open: closing discards
 * the search by unmounting, so there is no reset to keep in sync with `open` — which the parent owns
 * and flips directly on Mod+P, without ever passing through `onOpenChange`. Same split, for the same
 * reason, as `NoteLinkPickerContent`.
 */
function CommandPaletteContent({ notes, todos, onClose }: CommandPaletteContentProps) {
  const [inputValue, setInputValue] = useState('');
  const router = useRouter();
  const startNavigation = useReportedTransition();

  const isTagMode = inputValue.startsWith('@');
  const tagQuery = isTagMode ? inputValue.slice(1).toLowerCase() : '';
  const noteQuery = isTagMode ? '' : inputValue;

  const sortedNotes = useMemo(() => sortNotesForPalette(notes), [notes]);
  const visibleNotes = useMemo(() => rankByQuery(sortedNotes, noteQuery, noteSearchText), [sortedNotes, noteQuery]);
  const visibleTodos = useMemo(() => rankByQuery(todos, noteQuery, todoSearchText), [todos, noteQuery]);

  const allTagPaths = useMemo(() => listAllTagPaths(notes), [notes]);
  // Fuzzy and ranked, unlike TagInput's substring filter in the editor — deliberately not
  // unified: different widget, and fuzzy matching there was not asked for.
  const filteredTags = useMemo(
    () => (isTagMode ? rankByQuery(allTagPaths, tagQuery, tagPathText) : []),
    [isTagMode, tagQuery, allTagPaths],
  );

  const navigate = useCallback(
    (path: string) => {
      onClose();
      startNavigation(() => {
        router.push(path);
      });
    },
    [onClose, router, startNavigation],
  );

  const handleTagSelect = useCallback(
    (path: string) => {
      onClose();
      tagNavigationStore.navigateTo(path);
      viewStore.set('tags');
      startNavigation(() => {
        router.push('/notes');
      });
    },
    [onClose, router, startNavigation],
  );

  return (
    <>
      {/* Controlled, because with cmdk's filtering off (the Command default) the query has to be
          tracked somewhere: without it there is nothing to rank against. */}
      <CommandInput
        placeholder={isTagMode ? 'Tag suchen…' : 'Suchen…'}
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

        {isTagMode ? (
          <CommandGroup heading="Tags">
            {filteredTags.map((entry) => (
              <CommandItem
                key={entry.path}
                value={entry.path}
                onSelect={() => {
                  handleTagSelect(entry.path);
                }}
              >
                <TagFolderIcon />
                <span className="truncate">{entry.path}</span>
                <Badge variant="secondary" className="ml-auto text-xs px-1 py-0">
                  {entry.noteCount}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            {visibleNotes.length > 0 && (
              <CommandGroup heading="Notizen">
                {visibleNotes.map((note) => (
                  <NoteCommandItem
                    key={note.id}
                    note={note}
                    onSelect={() => {
                      navigate(`/notes/${note.id}`);
                    }}
                  />
                ))}
              </CommandGroup>
            )}

            {visibleTodos.length > 0 && (
              <CommandGroup heading="Aufgaben">
                {visibleTodos.map((todo) => (
                  <CommandItem
                    key={todo.id}
                    value={todo.id}
                    onSelect={() => {
                      navigate('/todos');
                    }}
                  >
                    <ListChecks />
                    <span className="truncate">{todo.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </>
  );
}

export function CommandPalette({ notes, todos, open, onOpenChange }: CommandPaletteProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Befehlspalette"
      description="Suche nach Notizen, Aufgaben oder Tags…"
      showCloseButton={false}
    >
      <CommandPaletteContent notes={notes} todos={todos} onClose={handleClose} />
    </CommandDialog>
  );
}
