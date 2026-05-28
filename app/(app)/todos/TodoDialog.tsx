'use client';

import { useRef, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClearableDateInput } from './ClearableDateInput';
import { LinkedNotesField } from './LinkedNotesField';
import { useData } from '../dataContext';
import { QUADRANT_META } from '@/lib/constants';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';
import type { NoteSummary } from '@/lib/types';

interface TodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo?: Todo;
  defaultQuadrant?: TodoQuadrant;
  defaultTitle?: string;
  autoFocusDueDate?: boolean;
  notes: NoteSummary[];
}

export function TodoDialog({
  open,
  onOpenChange,
  todo,
  defaultQuadrant,
  defaultTitle,
  autoFocusDueDate,
  notes,
}: TodoDialogProps) {
  const { createTodo, updateTodo, deleteTodo } = useData();
  const isEdit = todo !== undefined;
  const [title, setTitle] = useState(todo?.title ?? defaultTitle ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '');
  const [quadrant, setQuadrant] = useState<TodoQuadrant>(todo?.quadrant ?? defaultQuadrant ?? 'do');
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(todo?.linkedNoteIds ?? []);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = () => {
    if (title.trim() === '') {
      return;
    }

    setSaving(true);
    const desc = description.trim() !== '' ? description.trim() : undefined;
    const due = dueDate !== '' ? dueDate : undefined;
    const linked = linkedNoteIds.length > 0 ? linkedNoteIds : undefined;
    const base = { title: title.trim(), quadrant };
    const action = isEdit
      ? updateTodo(todo.id, { ...base, description: desc ?? null, dueDate: due ?? null, linkedNoteIds: linked ?? null })
      : createTodo({ ...base, description: desc, dueDate: due, linkedNoteIds: linked });
    void action
      .then(() => {
        onOpenChange(false);
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleDelete = () => {
    if (!isEdit) {
      return;
    }

    setDeleting(true);
    void deleteTodo(todo.id)
      .then(() => {
        onOpenChange(false);
      })
      .finally(() => {
        setDeleting(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          if (autoFocusDueDate === true && dueDateRef.current !== null) {
            e.preventDefault();
            dueDateRef.current.focus();
            dueDateRef.current.showPicker();
          }
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
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
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <Label className="mb-1.5" htmlFor="todo-due">
                  Fälligkeitsdatum
                </Label>
                <ClearableDateInput ref={dueDateRef} id="todo-due" value={dueDate} onChange={setDueDate} />
              </div>
              <div className="flex-1">
                <Label className="mb-1.5" htmlFor="todo-quadrant">
                  Kategorie
                </Label>
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

            <LinkedNotesField
              linkedNoteIds={linkedNoteIds}
              onAdd={(noteId) => {
                setLinkedNoteIds((prev) => (prev.includes(noteId) ? prev : [...prev, noteId]));
              }}
              onRemove={(noteId) => {
                setLinkedNoteIds((prev) => prev.filter((id) => id !== noteId));
              }}
              notes={notes}
            />
          </div>

          <DialogFooter className="flex-row gap-2">
            {isEdit && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Löschen
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Abbrechen
            </Button>
            <Button type="submit" size="sm" disabled={saving || title.trim() === ''}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
