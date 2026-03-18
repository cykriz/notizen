'use client';

import { useRef, useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClearableDateInput } from './ClearableDateInput';
import { LinkedNotesField } from './LinkedNotesField';
import { createTodoAction, updateTodoAction, deleteTodoAction } from './actions';
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
  const isEdit = todo !== undefined;
  const [title, setTitle] = useState(todo?.title ?? defaultTitle ?? '');
  const [description, setDescription] = useState(todo?.description ?? '');
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '');
  const [quadrant, setQuadrant] = useState<TodoQuadrant>(todo?.quadrant ?? defaultQuadrant ?? 'do');
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(todo?.linkedNoteIds ?? []);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const handleSave = () => {
    if (title.trim() === '') {
      return;
    }

    startSaving(async () => {
      const base = {
        title: title.trim(),
        quadrant,
      };
      if (isEdit) {
        await updateTodoAction(todo.id, {
          ...base,
          description: description.trim() !== '' ? description.trim() : null,
          dueDate: dueDate !== '' ? dueDate : null,
          linkedNoteIds: linkedNoteIds.length > 0 ? linkedNoteIds : null,
        });
      } else {
        await createTodoAction({
          ...base,
          description: description.trim() !== '' ? description.trim() : undefined,
          dueDate: dueDate !== '' ? dueDate : undefined,
          linkedNoteIds: linkedNoteIds.length > 0 ? linkedNoteIds : undefined,
        });
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
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="todo-due">
                  Fälligkeitsdatum
                </label>
                <ClearableDateInput
                  ref={dueDateRef}
                  id="todo-due"
                  value={dueDate}
                  onChange={setDueDate}
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
