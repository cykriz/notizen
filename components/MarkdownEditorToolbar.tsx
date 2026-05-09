'use client';

import { Heading, IndentIncrease, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarkdownEditorToolbarProps {
  onIncreaseHeading: () => void;
  onIndentMore: () => void;
  onAddOrToggleCheckbox: () => void;
}

export function MarkdownEditorToolbar({
  onIncreaseHeading,
  onIndentMore,
  onAddOrToggleCheckbox,
}: MarkdownEditorToolbarProps) {
  return (
    <div
      className="flex md:hidden items-center gap-1 border-t px-2 py-1 shrink-0 bg-background"
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    >
      <Button size="icon-xs" variant="ghost" onClick={onIncreaseHeading}>
        <Heading />
        <span className="sr-only">Überschrift</span>
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={onAddOrToggleCheckbox}>
        <ListTodo />
        <span className="sr-only">Aufgabe</span>
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={onIndentMore}>
        <IndentIncrease />
        <span className="sr-only">Einrücken</span>
      </Button>
    </div>
  );
}
