'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';
import { DEFAULT_NOTE_TITLE } from '@/lib/constants';
import { useData } from './dataContext';

// Shared note-creation for the sidebar: creates a note with the given tags,
// closes the mobile sidebar, and navigates to the new note. Guards against
// concurrent creates via pendingRef.
export function useCreateNote() {
  const { createNote } = useData();
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const createNoteWithTags = useCallback(
    (tags: string[]) => {
      if (pendingRef.current) {
        return;
      }

      pendingRef.current = true;
      setPending(true);
      void createNote({ title: DEFAULT_NOTE_TITLE, content: '', tags })
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

  return { pending, createNoteWithTags };
}
