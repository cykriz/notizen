import { useEffect, type RefObject } from 'react';
import type { MarkdownEditorHandle } from '@/components/MarkdownEditor';
import { extractHeadings } from '@/components/NoteOutline';

interface UseAutoShowOutlineOptions {
  noteId: string;
  initialContent: string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  setOutlineVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAutoShowOutline({
  noteId,
  initialContent,
  editorRef,
  setOutlineVisible,
}: UseAutoShowOutlineOptions) {
  useEffect(() => {
    if (extractHeadings(initialContent).length < 2) {
      return;
    }

    const container = editorRef.current?.getScrollContainer();
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (container.scrollHeight > container.clientHeight) {
        setOutlineVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(container);
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }

    return () => {
      observer.disconnect();
    };
  }, [noteId, initialContent, editorRef, setOutlineVisible]);
}
