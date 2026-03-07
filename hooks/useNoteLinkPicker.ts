import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import type { NoteSummary } from '@/lib/types';

interface UseNoteLinkPickerOptions {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  valueRef: RefObject<string>;
  onChangeRef: RefObject<(v: string) => void>;
  notes?: NoteSummary[];
}

export function useNoteLinkPicker({ textareaRef, valueRef, onChangeRef, notes }: UseNoteLinkPickerOptions) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cursorPosRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' && (e.metaKey || e.ctrlKey) && notes && notes.length > 0) {
        e.preventDefault();
        cursorPosRef.current = textareaRef.current?.selectionStart ?? valueRef.current.length;
        setPickerOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notes, textareaRef, valueRef]);

  const handleNoteSelect = useCallback(
    (note: NoteSummary) => {
      const link = `[${note.title}](/notes/${note.id})`;
      const pos = cursorPosRef.current;
      onChangeRef.current(`${valueRef.current.slice(0, pos)}${link}${valueRef.current.slice(pos)}`);
    },
    [onChangeRef, valueRef],
  );

  const checkLinkTrigger = useCallback(
    (next: string, pos: number): boolean => {
      if (notes && notes.length > 0 && pos >= 2 && next.slice(pos - 2, pos) === '[[') {
        cursorPosRef.current = pos - 2;
        onChangeRef.current(next.slice(0, pos - 2) + next.slice(pos));
        setPickerOpen(true);
        return true;
      }

      return false;
    },
    [notes, onChangeRef],
  );

  return { pickerOpen, setPickerOpen, handleNoteSelect, checkLinkTrigger };
}
