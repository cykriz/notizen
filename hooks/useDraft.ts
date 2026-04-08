import { useCallback, useEffect, useRef } from 'react';
import { clearDraft, setDraft } from '@/lib/localCache';
import { DRAFT_DEBOUNCE_MS } from '@/lib/constants';

interface UseDraftArgs {
  noteId: string;
  saved: boolean;
  initialTitle: string;
  initialContent: string;
}

export function useDraft({ noteId, saved, initialTitle, initialContent }: UseDraftArgs) {
  const titleRef = useRef(initialTitle);
  const contentRef = useRef(initialContent);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(
    (title: string, content: string) => {
      titleRef.current = title;
      contentRef.current = content;

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setDraft(noteId, title, content);
      }, DRAFT_DEBOUNCE_MS);
    },
    [noteId],
  );

  const onTitleChange = useCallback(
    (title: string) => {
      schedule(title, contentRef.current);
    },
    [schedule],
  );

  const onContentChange = useCallback(
    (content: string) => {
      schedule(titleRef.current, content);
    },
    [schedule],
  );

  // Clear draft when auto-save succeeds
  useEffect(() => {
    if (saved) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      clearDraft(noteId);
    }
  }, [saved, noteId]);

  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  // On unmount: flush pending draft synchronously so it isn't lost
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        // Don't re-persist if already saved — avoids race with clearDraft
        if (!savedRef.current) {
          setDraft(noteId, titleRef.current, contentRef.current);
        }
      }
    };
  }, [noteId]);

  return { onTitleChange, onContentChange };
}
