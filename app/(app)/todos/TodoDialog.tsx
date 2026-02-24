'use client';

import { useState, useTransition } from 'react';
import { Loader2, Trash2, FileText, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NoteLinkPicker } from '@/components/NoteLinkPicker';
import { createTodoAction, updateTodoAction, deleteTodoAction } from './actions';
import { QUADRANT_META } from '@/lib/constants';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';
import type { NoteSummary } from '@/lib/types';

interface TodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo?: Todo;
  defaultQuadrant?: TodoQuadrant;
  notes: NoteSummary[];
}

export function TodoDialog({ open, onOpenChange, todo, defaultQuadrant, notes }: TodoDialogProps) {
  const isEdit = todo !== undefined;
  const [title, setTitle] = useState(todo?.title ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '');
  const [quadrant, setQuadrant] = useState<TodoQuadrant>(todo?.quadrant ?? defaultQuadrant ?? 'do');
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(todo?.linkedNoteIds ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const handleSave = () => {
    if (title.trim() === '') {
      return;
    }

    startSaving(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() !== '' ? description.trim() : undefined,
        dueDate: dueDate !== '' ? dueDate : undefined,
        linkedNoteIds: linkedNoteIds.length > 0 ? linkedNoteIds : undefined,
        quadrant,
      };
      if (isEdit) {
        await updateTodoAction(todo.id, payload);
      } else {
        await createTodoAction(payload);
      }

      onOpenChange(false);
    });
  };

  const handleDelete = () => {
    if (!isEdit) {
      return;
    }

    startDeleting(async () => {
      await deleteTodoAction(todo.id);
      onOpenChange(false);
    });
  };

  const handleAddNote = (note: NoteSummary) => {
    setLinkedNoteIds((prev) => (prev.includes(note.id) ? prev : [...prev, note.id]));
  };

  const handleRemoveNote = (noteId: string) => {
    setLinkedNoteIds((prev) => prev.filter((id) => id !== noteId));
  };

  const resolveTitle = (noteId: string) => notes.find((n) => n.id === noteId)?.title ?? 'Unbekannte Notiz';

  const availableNotes = notes.filter((n) => !linkedNoteIds.includes(n.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input
            placeholder="Titel…"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
          <Textarea
            placeholder="Beschreibung (optional)…"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            rows={3}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="todo-due">
                Fälligkeitsdatum
              </label>
              <Input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                }}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="todo-quadrant">
                Kategorie
              </label>
              <Select
                value={quadrant}
                onValueChange={(v) => {
                  setQuadrant(v as TodoQuadrant);
                }}
              >
                <SelectTrigger id="todo-quadrant" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUADRANT_META.map((q) => (
                    <SelectItem key={q.key} value={q.key}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Verknüpfte Notizen</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {linkedNoteIds.map((nid) => (
                <Badge key={nid} variant="secondary" className="gap-1 pr-1">
                  <FileText className="h-3 w-3" />
                  <span className="max-w-32 truncate">{resolveTitle(nid)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveNote(nid);
                    }}
                    className="rounded-sm hover:bg-accent p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {availableNotes.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
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
        </div>

        <DialogFooter className="flex-row gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Löschen
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || title.trim() === ''}>
            {saving && <Loader2 className="animate-spin" />}
            {isEdit ? 'Speichern' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <NoteLinkPicker notes={availableNotes} open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleAddNote} />
    </Dialog>
  );
}
