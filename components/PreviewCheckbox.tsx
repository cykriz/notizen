'use client';

import { createContext, useContext, type JSX } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { toggleBlockCheckboxes, toggleCheckboxAtOffset } from '@/lib/toggleCheckbox';

// Matches the task-list checkbox marker inside a list item line.
// Broad match is safe because callers only reach this via data-source-offset
// on <li> elements produced by remark's task-list plugin.
const CHECKBOX_RE = /\[([ xX])\]/;

interface PreviewCheckboxContextValue {
  getSource: () => string;
  onChange: (v: string) => void;
}

export const PreviewCheckboxContext = createContext<PreviewCheckboxContextValue | null>(null);

function findCheckboxOffset(source: string, liOffset: number): number | null {
  const lineEnd = source.indexOf('\n', liOffset);
  const line = source.slice(liOffset, lineEnd === -1 ? undefined : lineEnd);
  const match = CHECKBOX_RE.exec(line);
  return match ? liOffset + match.index : null;
}

function findSourceOffset(el: HTMLElement): number | null {
  const li = el.closest('li');
  if (!li) {
    return null;
  }

  const attr = li.getAttribute('data-source-offset');
  return attr !== null ? Number(attr) : null;
}

/**
 * Component override for `<input>` in the markdown preview.
 * Checkbox inputs become interactive shadcn Checkboxes; all
 * other input types fall through to a plain `<input>`.
 *
 * Reads `getSource`/`onChange` from PreviewCheckboxContext so the
 * component identity is stable (no factory re-creation).
 */
export function PreviewCheckbox(props: JSX.IntrinsicElements['input']) {
  const ctx = useContext(PreviewCheckboxContext);

  if (props.type !== 'checkbox') {
    return <input {...props} />;
  }

  if (ctx === null) {
    return null;
  }

  const toggle = (el: HTMLElement, blockToggle: boolean) => {
    const source = ctx.getSource();
    const liOffset = findSourceOffset(el);
    if (liOffset === null) {
      return;
    }

    const bracketPos = findCheckboxOffset(source, liOffset);
    if (bracketPos === null) {
      return;
    }

    const updated = blockToggle
      ? toggleBlockCheckboxes(source, bracketPos)
      : toggleCheckboxAtOffset(source, bracketPos);

    if (updated !== source) {
      ctx.onChange(updated);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    toggle(e.currentTarget, e.metaKey || e.ctrlKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      toggle(e.currentTarget, e.metaKey || e.ctrlKey);
    }
  };

  const checked = props.checked === true;

  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label="Aufgabe umschalten"
      tabIndex={0}
      data-slot="checkbox"
      className="preview-checkbox inline-flex items-center cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} aria-hidden />
    </span>
  );
}
