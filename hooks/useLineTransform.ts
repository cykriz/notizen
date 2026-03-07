import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type LineTransform = (line: string) => { newLine: string; cursorDelta: number };

export function useLineTransform(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (v: string) => void,
) {
  const pendingCursorRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null) {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = pendingCursorRef.current;
        textarea.selectionEnd = pendingCursorRef.current;
      }

      pendingCursorRef.current = null;
    }
  }, [value, textareaRef]);

  const transformCurrentLine = useCallback(
    (transform: LineTransform) => {
      if (!textareaRef.current) {
        return;
      }

      const { selectionStart } = textareaRef.current;
      const val = valueRef.current;
      const lineStart = val.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEndIdx = val.indexOf('\n', selectionStart);
      const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;

      const { newLine, cursorDelta } = transform(val.slice(lineStart, lineEnd));

      onChangeRef.current(val.slice(0, lineStart) + newLine + val.slice(lineEnd));
      pendingCursorRef.current = Math.max(lineStart, selectionStart + cursorDelta);
    },
    [textareaRef],
  );

  // Cycles: plain text → h1 → h2 → … → h6 → plain text
  const increaseHeading = useCallback(() => {
    transformCurrentLine((line) => {
      const m = /^(#{1,6})\s/.exec(line);
      if (!m) {
        return { newLine: `# ${line}`, cursorDelta: 2 };
      }

      if (m[1].length >= 6) {
        return { newLine: line.slice(m[0].length), cursorDelta: -m[0].length };
      }

      return { newLine: `#${line}`, cursorDelta: 1 };
    });
  }, [transformCurrentLine]);

  const indentList = useCallback(() => {
    transformCurrentLine((line) => ({ newLine: `  ${line}`, cursorDelta: 2 }));
  }, [transformCurrentLine]);

  return { increaseHeading, indentList };
}
