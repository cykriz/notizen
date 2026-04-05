'use client';

import { FileText, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import type { NoteSummary } from '@/lib/types';

interface NoteLinkPickerProps {
  notes: NoteSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (note: NoteSummary) => void;
}

export function NoteLinkPicker({ notes, open, onOpenChange, onSelect }: NoteLinkPickerProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Notiz verknüpfen"
      description="Suche nach einer Notiz zum Verknüpfen…"
      showCloseButton={false}
    >
      <CommandInput placeholder="Notiz suchen…" />
      <CommandList>
        <CommandEmpty>Keine Notizen gefunden.</CommandEmpty>
        {notes.length > 0 && (
          <CommandGroup heading="Notizen">
            {notes.map((note) => (
              <CommandItem
                key={note.id}
                value={note.id}
                keywords={[note.title, ...note.tags.map((t) => `#${t}`)]}
                onSelect={() => {
                  onSelect(note);
                  onOpenChange(false);
                }}
              >
                {note.pinned ? <Pin /> : <FileText />}
                <span className="truncate">{note.title}</span>
                {note.tags.slice(0, 2).map((tag, i) => (
                  <Badge key={tag} variant="secondary" className={cn('text-[10px] px-1 py-0', { 'ml-auto': i === 0 })}>
                    {tag.split('/').pop()}
                  </Badge>
                ))}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
