'use client';

import { createContext, useContext, type JSX } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
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
 * Checkbox inputs become shadcn Checkboxes; all other input types
 * fall through to a plain `<input>`.
 *
 * Reads `getSource`/`onChange` from PreviewCheckboxContext so the
 * component identity is stable (no factory re-creation). Without a
 * provider (read-only views like the share page) the checkbox renders
 * non-interactive instead of disappearing.
 */
export function PreviewCheckbox(props: JSX.IntrinsicElements['input']) {
  const ctx = useContext(PreviewCheckboxContext);

  if (props.type !== 'checkbox') {
    return <input {...props} />;
  }

  const isChecked = props.checked === true;
  const interactive = ctx !== null;

  const toggle = (el: HTMLElement, blockToggle: boolean) => {
    if (ctx === null) {
      return;
    }

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

  return (
    <span
      role="checkbox"
      aria-checked={isChecked}
      aria-readonly={interactive ? undefined : true}
      aria-label={interactive ? 'Aufgabe umschalten' : 'Aufgabe'}
      tabIndex={interactive ? 0 : undefined}
      data-slot="checkbox"
      className={cn('preview-checkbox', { 'cursor-pointer': interactive })}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <Checkbox checked={isChecked} className="pointer-events-none" tabIndex={-1} aria-hidden />
    </span>
  );
}

/**
 * Stable component override map for read-only previews (no toggle context).
 * Module-level constant — the object closes over nothing, so a hook would
 * only add noise.
 */
export const READONLY_PREVIEW_COMPONENTS = { input: PreviewCheckbox };
