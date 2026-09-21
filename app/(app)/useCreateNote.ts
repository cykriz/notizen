'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';
import { DEFAULT_NOTE_TITLE } from '@/lib/constants';
import { useData } from './dataContext';
import { tagNavigationStore } from './tagNavigationStore';
import { viewStore } from './viewStore';

// Shared note-creation for the sidebar and the command palette: creates a note with the
// given tags and title, closes the mobile sidebar, and navigates to the new note. Guards
// against concurrent creates via pendingRef.
export function useCreateNote() {
  const { createNote } = useData();
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const createNoteWithTags = useCallback(
    // `title` defaults so every caller that has no name to give — the sidebar button, the
    // double-click, the empty state, createTagFolder — stays untouched. Only the palette's
    // create row passes one, and `content` stays '' either way: that empty body is what puts
    // the new note into edit mode with the cursor already in it (useNoteInitialState).
    (tags: string[], title: string = DEFAULT_NOTE_TITLE) => {
      if (pendingRef.current) {
        return;
      }

      pendingRef.current = true;
      setPending(true);
      void createNote({ title, content: '', tags })
        .then((note) => {
          if (note.slug !== '') {
            setOpenMobile(false);
            router.push(`/notes/${note.id}`);
          }
        })
        .finally(() => {
          pendingRef.current = false;
          setPending(false);
        });
    },
    [createNote, router, setOpenMobile],
  );

  /**
   * Creates a tag folder at `path`. A tag exists only as frontmatter on a note, so the folder
   * IS its first note — the same contract CreateTagFolderDialog spells out to the user.
   *
   * Jump first, create second: `navigateTo` sets the sidebar path even while the folder is
   * still absent from the tree (the force-jump in useTagStateSync), and once the optimistic
   * note lands the folder exists. The note-open sync that follows re-targets to
   * `note.tags[0]` — the same path — so the two never fight over it.
   *
   * Shared by the sidebar's "Neuer Ordner" and the palette's create row, and deliberately a
   * second return value rather than its own hook: the sidebar needs BOTH creates and has to
   * get them from one instance, or its `pending` would only see half of them. The palette
   * holds its own instance — nothing there renders `pending`, and its guard only has to
   * survive a double Enter inside one open dialog.
   */
  const createTagFolder = useCallback(
    (path: string) => {
      viewStore.set('tags');
      tagNavigationStore.navigateTo(path);
      createNoteWithTags([path]);
    },
    [createNoteWithTags],
  );

  return { pending, createNoteWithTags, createTagFolder };
}
