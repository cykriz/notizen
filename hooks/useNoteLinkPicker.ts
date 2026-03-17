import { useState, useCallback, useRef, useMemo, type RefObject } from 'react';
import { keymap, type EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { NoteSummary } from '@/lib/types';

interface UseNoteLinkPickerOptions {
  viewRef: RefObject<EditorView | null>;
  notes?: NoteSummary[];
}

export function useNoteLinkPicker({ viewRef, notes }: UseNoteLinkPickerOptions) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const cursorPosRef = useRef<number>(0);

  // CM6 keymap — Mod+L only fires when the editor has focus.
  // `run` is called at CM6 dispatch time, never during render, so cursorPosRef
  // is safe to write here. react-hooks/refs is a false positive in this context.
  // eslint-disable-next-line react-hooks/refs
  const noteLinkExtension = useMemo<Extension>(() => keymap.of([{
    key: 'Mod-l',
    run(view) {
      if (notes === undefined || notes.length === 0) {
        return false;
      }

      cursorPosRef.current = view.state.selection.main.head;
      setPickerOpen(true);
      return true;
    },
  }]), [notes]);

  // Called from MarkdownEditor onChange to detect [[ trigger
  const checkLinkTrigger = useCallback(
    (next: string, pos: number, view: EditorView): boolean => {
      if (notes !== undefined && notes.length > 0 && pos >= 2 && next.slice(pos - 2, pos) === '[[') {
        cursorPosRef.current = pos - 2;
        view.dispatch({ changes: { from: pos - 2, to: pos, insert: '' } });
        setPickerOpen(true);
        return true;
      }

      return false;
    },
    [notes],
  );

  const handleNoteSelect = useCallback(
    (note: NoteSummary) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const link = `[${note.title}](/notes/${note.id})`;
      const pos = cursorPosRef.current;
      view.dispatch({
        changes: { from: pos, insert: link },
        selection: { anchor: pos + link.length },
      });
      view.focus();
    },
    [viewRef],
  );

  return { pickerOpen, setPickerOpen, handleNoteSelect, checkLinkTrigger, noteLinkExtension };
}
