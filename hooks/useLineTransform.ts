import { useCallback, type RefObject } from 'react';
import { transformLineToCheckbox } from '@/lib/toggleCheckbox';
import type { EditorView } from '@codemirror/view';

export function useLineTransform(viewRef: RefObject<EditorView | null>) {
  // Cycles: plain text → h1 → h2 → … → h6 → plain text
  const increaseHeading = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const headingMatch = /^(#{1,6})\s/.exec(line.text);

    let updatedLine: string;
    let cursorOffset: number;

    if (!headingMatch) {
      updatedLine = `# ${line.text}`;
      cursorOffset = 2;
    } else if (headingMatch[1].length >= 6) {
      updatedLine = line.text.slice(headingMatch[0].length);
      cursorOffset = -headingMatch[0].length;
    } else {
      updatedLine = `#${line.text}`;
      cursorOffset = 1;
    }

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: updatedLine },
      selection: { anchor: Math.max(line.from, from + cursorOffset) },
    });
    view.focus();
  }, [viewRef]);

  const addOrToggleCheckbox = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const { line: updatedLine, cursorDelta } = transformLineToCheckbox(line.text);

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: updatedLine },
      selection: { anchor: Math.max(line.from, from + cursorDelta) },
    });
    view.focus();
  }, [viewRef]);

  return { increaseHeading, addOrToggleCheckbox };
}
