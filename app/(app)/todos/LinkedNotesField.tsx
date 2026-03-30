'use client';

import { useState } from 'react';
import { FileText, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NoteLinkPicker } from '@/components/NoteLinkPicker';
import type { NoteSummary } from '@/lib/types';

interface LinkedNotesFieldProps {
  linkedNoteIds: string[];
  onAdd: (noteId: string) => void;
  onRemove: (noteId: string) => void;
  notes: NoteSummary[];
}

export function LinkedNotesField({ linkedNoteIds, onAdd, onRemove, notes }: LinkedNotesFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const resolveTitle = (noteId: string) => notes.find((n) => n.id === noteId)?.title ?? 'Unbekannte Notiz';

  const availableNotes = notes.filter((n) => !linkedNoteIds.includes(n.id));

  return (
    <>
      <div>
        <Label className="mb-1.5">Verknüpfte Notizen</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {linkedNoteIds.map((nid) => (
            <Badge key={nid} variant="secondary" className="gap-1 pr-1">
              <FileText className="h-3 w-3" />
              <span className="max-w-32 truncate">{resolveTitle(nid)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  onRemove(nid);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          {availableNotes.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => {
                setPickerOpen(true);
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Notiz verknüpfen
            </Button>
          )}
        </div>
      </div>
      <NoteLinkPicker
        notes={availableNotes}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(note) => {
          onAdd(note.id);
        }}
      />
    </>
  );
}
