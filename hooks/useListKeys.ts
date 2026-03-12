import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';

type PendingList = { marker: string } | 'exit' | null;

const LIST_RE = /^(\s*)(([*+-])|((\d+)\.))(\s)/;

/**
 * List shortcuts for the editor textarea: Tab indent/dedent, Enter continuation.
 * Tab is handled directly (capture-phase preventDefault). Enter stores
 * intent in a ref — call `applyPendingList` in onChange to apply it.
 */
export function useListKeys(
  wrapperRef: RefObject<HTMLDivElement | null>,
  value: string,
  onChange: (v: string) => void,
) {
  const valueRef = useRef(value);
  /** Ref so keydown handler and applyPendingList always call the latest onChange without re-subscribing or stale closures. */
  const onChangeRef = useRef(onChange);
  const pendingRef = useRef<PendingList>(null);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' && e.key !== 'Enter') {
        return;
      }

      const textarea = wrapper.querySelector('textarea');
      if (!textarea || e.target !== textarea) {
        return;
      }

      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart !== selectionEnd) {
        return;
      }

      const val = valueRef.current;
      const lineStart = val.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEndIdx = val.indexOf('\n', selectionStart);
      const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
      const line = val.slice(lineStart, lineEnd);

      const m = LIST_RE.exec(line);
      if (!m) {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const savedScroll = textarea.scrollTop;

        if (e.shiftKey) {
          const sp = /^( {1,2})/.exec(line);
          if (!sp) {
            return;
          }

          const removed = sp[1].length;
          const newPos = Math.max(lineStart, selectionStart - removed);
          flushSync(() => {
            onChangeRef.current(val.slice(0, lineStart) + line.slice(removed) + val.slice(lineEnd));
          });
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
        } else {
          const newPos = selectionStart + 2;
          flushSync(() => {
            onChangeRef.current(`${val.slice(0, lineStart)}  ${line}${val.slice(lineEnd)}`);
          });
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
        }

        textarea.scrollTop = savedScroll;
        return;
      }

      const content = line.slice(m[0].length);
      if (content.trim() === '') {
        pendingRef.current = 'exit';
      } else {
        const num = /^(\d+)\./.exec(m[2]);
        const next = num ? `${String(Number(num[1]) + 1)}.` : m[2];
        pendingRef.current = { marker: `${m[1]}${next} ` };
      }
    };

    wrapper.addEventListener('keydown', handler, true);
    return () => {
      wrapper.removeEventListener('keydown', handler, true);
    };
  }, [wrapperRef]);

  const applyPendingList = useCallback(
    (next: string, pos: number): number | false => {
      const pending = pendingRef.current;
      if (pending === null) {
        return false;
      }

      pendingRef.current = null;
      const curLineStart = next.lastIndexOf('\n', pos - 1) + 1;

      if (pending === 'exit') {
        const prevLineStart = next.lastIndexOf('\n', curLineStart - 2) + 1;
        onChangeRef.current(next.slice(0, prevLineStart) + next.slice(pos));
        return prevLineStart;
      }

      onChangeRef.current(next.slice(0, curLineStart) + pending.marker + next.slice(pos));
      return curLineStart + pending.marker.length;
    },
    [],
  );

  return { applyPendingList };
}
