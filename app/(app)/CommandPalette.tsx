'use client';

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { CommandDialog, CommandInput, CommandList, CommandEmpty } from '@/components/ui/command';
import {
  noteCreateCandidate,
  noteSearchText,
  rankByQuery,
  sortNotesForPalette,
  tagCreateCandidate,
} from '@/lib/commandSearch';
import { listAllTagPaths } from '@/lib/tagTree';
import { NOTES_PATH, NOTES_PATH_PREFIX, TODOS_PATH } from '@/lib/pathConstants';
import { CommandPaletteNotes } from './CommandPaletteNotes';
import { CommandPaletteTags } from './CommandPaletteTags';
import { currentFolderStore, folderTags } from './currentFolderStore';
import { useCreateNote } from './useCreateNote';
import { useReportedTransition } from './navigationLoading';
import { viewStore } from './viewStore';
import { tagNavigationStore } from './tagNavigationStore';
import type { NoteSummary, Todo } from '@/lib/types';

interface CommandPaletteProps {
  notes: NoteSummary[];
  todos: Todo[];
  /** Lives in `paletteStore`; the Mod+P binding sits in CommandPaletteClient — see the note there. */
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
 * the search by unmounting, so there is no reset to keep in sync with `open` — which lives in
 * `paletteStore` and is flipped directly by both Mod+P and the mobile search button, without ever
 * passing through `onOpenChange`. Same split, for the same reason, as `NoteLinkPickerContent`.
 */
function CommandPaletteContent({ notes, todos, onClose }: CommandPaletteContentProps) {
  const [inputValue, setInputValue] = useState('');
  const router = useRouter();
  const startNavigation = useReportedTransition();
  // Not hoisted out of this (unmounting) subtree: the create is a promise whose continuation
  // survives the unmount, and `pending` is never rendered here.
  const { createNoteWithTags, createTagFolder } = useCreateNote();
  // The folder the sidebar is browsing — the palette creates into the same one its
  // "Neue Notiz" button does. Published by AppSidebar; see currentFolderStore.
  const folderPath = useSyncExternalStore(
    currentFolderStore.subscribe,
    currentFolderStore.getSnapshot,
    currentFolderStore.getServerSnapshot,
  );

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
  const createPath = useMemo(
    () => (isTagMode ? tagCreateCandidate(tagQuery, allTagPaths) : null),
    [isTagMode, tagQuery, allTagPaths],
  );
  // No isTagMode guard: noteQuery is already '' there, and the row only renders in the
  // non-tag branch anyway.
  const createTitle = useMemo(() => noteCreateCandidate(noteQuery), [noteQuery]);

  const navigate = useCallback(
    (path: string) => {
      onClose();
      startNavigation(() => {
        router.push(path);
      });
    },
    [onClose, router, startNavigation],
  );

  // Both tag actions land on /notes: the sidebar is where a tag is browsed, and the palette can
  // be open over any page. For a create it is also the only visible outcome while offline, where
  // createTagFolder cannot open the new note yet (no slug until the server answers — see
  // createNoteOffline).
  const handleTagSelect = useCallback(
    (path: string) => {
      tagNavigationStore.navigateTo(path);
      viewStore.set('tags');
      navigate(NOTES_PATH);
    },
    [navigate],
  );

  const handleTagCreate = useCallback(
    (path: string) => {
      createTagFolder(path);
      navigate(NOTES_PATH);
    },
    [createTagFolder, navigate],
  );

  // Create first, close second — same contract as handleTagCreate: the create's continuation
  // survives this subtree's unmount. Not through `navigate`, which would push NOTES_PATH
  // against the hook's own push to the new note. A double Enter is caught twice over:
  // useCreateNote's pendingRef, and this onClose unmounting the row in the same tick. Offline
  // it ends silently — no slug yet, so the hook skips its push and only the sidebar's new row
  // shows the note; the consolation push handleTagSelect makes would race the online one.
  const handleNoteCreate = useCallback(
    (title: string) => {
      createNoteWithTags(folderTags(folderPath), title);
      onClose();
    },
    [createNoteWithTags, folderPath, onClose],
  );

  const handleNoteSelect = useCallback(
    (id: string) => {
      navigate(`${NOTES_PATH_PREFIX}${id}`);
    },
    [navigate],
  );

  const handleTodoSelect = useCallback(() => {
    navigate(TODOS_PATH);
  }, [navigate]);

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
        {/* In note mode this now only shows for an empty query in an empty app: as soon as
            anything is typed, the create row stands here instead. */}
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

        {isTagMode ? (
          <CommandPaletteTags
            entries={filteredTags}
            createPath={createPath}
            onSelect={handleTagSelect}
            onCreate={handleTagCreate}
          />
        ) : (
          <CommandPaletteNotes
            notes={visibleNotes}
            todos={visibleTodos}
            createTitle={createTitle}
            folderPath={folderPath}
            onSelectNote={handleNoteSelect}
            onSelectTodo={handleTodoSelect}
            onCreate={handleNoteCreate}
          />
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
      // Top-anchored below lg, centred from lg up: on a phone the on-screen keyboard covers the
      // lower half of the viewport, and DialogContent's own `top-1/2` put the result list behind it.
      // `lg` is the same 1024px boundary as `MOBILE_BREAKPOINT` in hooks/use-mobile.ts.
      className="top-4 translate-y-0 lg:top-1/2 lg:-translate-y-1/2"
    >
      <CommandPaletteContent notes={notes} todos={todos} onClose={handleClose} />
    </CommandDialog>
  );
}
