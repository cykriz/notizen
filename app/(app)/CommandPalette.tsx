'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
}

const todoSearchText = (todo: Todo) => todo.title;
const tagPathText = (entry: { path: string }) => entry.path;

export function CommandPalette({ notes, todos }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setInputValue('');
      startNavigation(() => {
        router.push(path);
      });
    },
    [router, startNavigation],
  );

  const handleTagSelect = useCallback(
    (path: string) => {
      setOpen(false);
      setInputValue('');
      tagNavigationStore.navigateTo(path);
      viewStore.set('tags');
      startNavigation(() => {
        router.push('/notes');
      });
    },
    [router, startNavigation],
  );

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (!v) {
      setInputValue('');
    }
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Befehlspalette"
      description="Suche nach Notizen, Aufgaben oder Tags…"
      showCloseButton={false}
    >
      {/* Kept controlled: uncontrolled would let cmdk update its `search` synchronously, but
          reopening during Radix's exit animation would hit the still-mounted store with the
          old search while inputValue is already '' — a wrong tag mode. */}
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
    </CommandDialog>
  );
}
