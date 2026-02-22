"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTodoAction, updateTodoAction, deleteTodoAction } from "./actions";
import { QUADRANT_META } from "@/lib/types";
import type { Todo, TodoQuadrant } from "@/lib/fsTodos";

interface TodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo?: Todo;
  defaultQuadrant?: TodoQuadrant;
}

export function TodoDialog({ open, onOpenChange, todo, defaultQuadrant }: TodoDialogProps) {
  const isEdit = todo !== undefined;
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? "");
  const [quadrant, setQuadrant] = useState<TodoQuadrant>(todo?.quadrant ?? defaultQuadrant ?? "do");
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const handleSave = () => {
    if (title.trim() === "") {
      return;
    }

    startSaving(async () => {
      if (isEdit) {
        await updateTodoAction(todo.id, {
          title: title.trim(),
          description: description.trim() !== "" ? description.trim() : undefined,
          dueDate: dueDate !== "" ? dueDate : undefined,
          quadrant,
        });
      } else {
        await createTodoAction({
          title: title.trim(),
          description: description.trim() !== "" ? description.trim() : undefined,
          dueDate: dueDate !== "" ? dueDate : undefined,
          quadrant,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle>
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
              <Select value={quadrant} onValueChange={(v) => {
                setQuadrant(v as TodoQuadrant); 
              }}>
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
        </div>

        <DialogFooter className="flex-row gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Löschen
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => {
            onOpenChange(false); 
          }}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || title.trim() === ""}>
            {saving && <Loader2 className="animate-spin" />}
            {isEdit ? "Speichern" : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
