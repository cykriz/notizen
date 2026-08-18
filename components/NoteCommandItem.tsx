'use client';

import { FileText, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CommandItem } from '@/components/ui/command';
import { leafTagSegment } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';

interface NoteCommandItemProps {
  note: NoteSummary;
  onSelect: () => void;
}

/**
 * One note row inside a cmdk list — shared by the command palette and the note link picker,
 * which carried near-identical copies of this markup.
 *
 * `value` stays the note id: cmdk identifies the selection by `data-value`, so two notes with
 * the same title would otherwise highlight as one row. It is deliberately NOT the search
 * haystack — ranking happens in lib/commandSearch.ts, see the note there on why.
 */
export function NoteCommandItem({ note, onSelect }: NoteCommandItemProps) {
  return (
    <CommandItem value={note.id} onSelect={onSelect}>
      {note.pinned ? <Pin /> : <FileText />}
      <span className="truncate">{note.title}</span>
      {note.tags.slice(0, 2).map((tag, i) => (
        <Badge key={tag} variant="secondary" className={cn('text-xs px-1 py-0', { 'ml-auto': i === 0 })}>
          {leafTagSegment(tag)}
        </Badge>
      ))}
    </CommandItem>
  );
}
