'use client';

import { Heading, IndentIncrease } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkdownEditorToolbarProps {
  keyboardOffset: number;
  onIncreaseHeading: () => void;
  onIndentMore: () => void;
}

export function MarkdownEditorToolbar({ keyboardOffset, onIncreaseHeading, onIndentMore }: MarkdownEditorToolbarProps) {
  return (
    <div
      className={cn('flex md:hidden items-center gap-1 border-t px-2 py-1 shrink-0 bg-background', {
        'fixed left-0 right-0 z-50 shadow-sm': keyboardOffset > 0,
      })}
      style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    >
      <Button size="icon-xs" variant="ghost" onClick={onIncreaseHeading}>
        <Heading />
        <span className="sr-only">Überschrift</span>
      </Button>
      <Button size="icon-xs" variant="ghost" onClick={onIndentMore}>
        <IndentIncrease />
        <span className="sr-only">Einrücken</span>
      </Button>
    </div>
  );
}
