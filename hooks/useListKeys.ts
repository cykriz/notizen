import { useEffect, useRef, type RefObject } from 'react';

type PendingList = { marker: string } | 'exit' | null;

const LIST_RE = /^(\s*)(([*+-])|((\d+)\.))(\s)/;

/**
 * List shortcuts for MDEditor: Tab indent/dedent, Enter continuation.
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
        if (e.shiftKey) {
          const sp = /^( {1,2})/.exec(line);
          if (!sp) {
            return;
          }

          const removed = sp[1].length;
          onChangeRef.current(val.slice(0, lineStart) + line.slice(removed) + val.slice(lineEnd));
          requestAnimationFrame(() => {
            const p = Math.max(lineStart, selectionStart - removed);
            textarea.selectionStart = p;
            textarea.selectionEnd = p;
          });
        } else {
          onChangeRef.current(`${val.slice(0, lineStart)}  ${line}${val.slice(lineEnd)}`);
          requestAnimationFrame(() => {
            const p = selectionStart + 2;
            textarea.selectionStart = p;
            textarea.selectionEnd = p;
          });
        }

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

  /** Returns true if the change was handled (caller should return early). */
  function applyPendingList(next: string, pos: number, textarea: HTMLTextAreaElement | null): boolean {
    const pending = pendingRef.current;
    if (pending === null) {
      return false;
    }

    pendingRef.current = null;

    const curLineStart = next.lastIndexOf('\n', pos - 1) + 1;

    if (pending === 'exit') {
      const prevLineStart = next.lastIndexOf('\n', curLineStart - 2) + 1;
      onChangeRef.current(next.slice(0, prevLineStart) + next.slice(pos));
      setCursor(textarea, prevLineStart);
      return true;
    }

    onChangeRef.current(next.slice(0, curLineStart) + pending.marker + next.slice(pos));
    setCursor(textarea, curLineStart + pending.marker.length);
    return true;
  }

  return { applyPendingList };
}

function setCursor(textarea: HTMLTextAreaElement | null, pos: number) {
  requestAnimationFrame(() => {
    if (!textarea) {
      return;
    }

    textarea.selectionStart = pos;
    textarea.selectionEnd = pos;
  });
}
