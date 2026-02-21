'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HeadingItem {
  level: number;
  text: string;
  line: number;
}

interface NoteOutlineProps {
  content: string;
  onHeadingClick?: (line: number) => void;
}

function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split('\n');
  const headings: HeadingItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[*_`~[\]]/g, ''),
        line: i,
      });
    }
  }

  return headings;
}

const LEVEL_INDENT: Record<number, string> = {
  1: 'pl-4',
  2: 'pl-7',
  3: 'pl-10',
  4: 'pl-13',
  5: 'pl-16',
  6: 'pl-19',
};

export function NoteOutline({ content, onHeadingClick }: NoteOutlineProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Keine Überschriften</div>
    );
  }

  return (
    <nav className="py-4 overflow-y-auto h-full">
      <p className="px-4 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gliederung</p>
      <ul>
        {headings.map((heading, idx) => (
          <li key={`${String(heading.line)}-${String(idx)}`}>
            <Button
              variant="ghost"
              className={cn(
                'w-full min-w-0 justify-start rounded-none h-auto px-0 pr-4 py-0.5 text-sm leading-10 text-muted-foreground hover:text-foreground',
                LEVEL_INDENT[heading.level] ?? 'pl-4',
                { 'font-medium text-foreground': heading.level === 1 },
              )}
              title={heading.text}
              onClick={() => {
                onHeadingClick?.(heading.line);
              }}
            >
              <span className="truncate">{heading.text}</span>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
