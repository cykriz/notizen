'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Folder, ListChecks, Pin, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { listAllTagPaths } from '@/lib/tagTree';
import { useReportedTransition } from './navigationLoading';
import { viewStore } from './viewStore';
import { tagNavigationStore } from './tagNavigationStore';
import type { NoteSummary, Todo } from '@/lib/types';

interface CommandPaletteProps {
  notes: NoteSummary[];
  todos: Todo[];
}

export function CommandPalette({ notes, todos }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const router = useRouter();
  const startNavigation = useReportedTransition();

  const isTagMode = inputValue.startsWith('@');
  const tagQuery = isTagMode ? inputValue.slice(1).toLowerCase() : '';

  const allTagPaths = useMemo(() => listAllTagPaths(notes), [notes]);
  const filteredTags = useMemo(() => {
    if (!isTagMode) {
      return [];
    }

    if (tagQuery === '') {
      return allTagPaths;
    }

    return allTagPaths.filter((entry) => entry.path.toLowerCase().includes(tagQuery));
  }, [isTagMode, tagQuery, allTagPaths]);

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
      commandProps={isTagMode ? { shouldFilter: false } : undefined}
    >
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
                {entry.isLeaf ? <Tag /> : <Folder />}
                <span className="truncate">{entry.path}</span>
                <Badge variant="secondary" className="ml-auto text-xs px-1 py-0">
                  {entry.noteCount}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            {notes.length > 0 && (
              <CommandGroup heading="Notizen">
                {notes.map((note) => (
                  <CommandItem
                    key={note.id}
                    value={note.id}
                    keywords={[note.title, ...note.tags.map((t) => `#${t}`)]}
                    onSelect={() => {
                      navigate(`/notes/${note.id}`);
                    }}
                  >
                    {note.pinned ? <Pin /> : <FileText />}
                    <span className="truncate">{note.title}</span>
                    {note.tags.slice(0, 2).map((tag, i) => (
                      <Badge key={tag} variant="secondary" className={cn('text-xs px-1 py-0', { 'ml-auto': i === 0 })}>
                        {tag.split('/').pop()}
                      </Badge>
                    ))}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {todos.length > 0 && (
              <CommandGroup heading="Aufgaben">
                {todos.map((todo) => (
                  <CommandItem
                    key={todo.id}
                    value={todo.id}
                    keywords={[todo.title]}
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
