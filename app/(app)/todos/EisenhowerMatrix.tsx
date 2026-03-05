'use client';

import { useState, useCallback, useMemo } from 'react';
import { QuadrantCard, quadrants } from './QuadrantCard';
import { TodoDialog } from './TodoDialog';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';
import type { NoteSummary } from '@/lib/types';

interface EisenhowerMatrixProps {
  todos: Todo[];
  notes: NoteSummary[];
}

export function EisenhowerMatrix({ todos, notes }: EisenhowerMatrixProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>(undefined);
  const [defaultQuadrant, setDefaultQuadrant] = useState<TodoQuadrant>('do');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [dialogKey, setDialogKey] = useState(0);

  const todosByQuadrant = useMemo(() => {
    const map: Record<TodoQuadrant, Todo[]> = { do: [], schedule: [], delegate: [], eliminate: [] };
    for (const t of todos) {
      map[t.quadrant].push(t);
    }
    return map;
  }, [todos]);

  const handleAdd = useCallback((quadrant: TodoQuadrant, title?: string) => {
    setEditingTodo(undefined);
    setDefaultQuadrant(quadrant);
    setDefaultTitle(title ?? '');
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setDefaultQuadrant(todo.quadrant);
    setDialogOpen(true);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTodo(undefined);
    }
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 py-2 px-3">
        {quadrants.map((meta) => (
          <QuadrantCard
            key={meta.key}
            meta={meta}
            todos={todosByQuadrant[meta.key]}
            onAdd={handleAdd}
            onEdit={handleEdit}
            notes={notes}
          />
        ))}
      </div>
      <TodoDialog
        key={editingTodo?.id ?? `new-${String(dialogKey)}`}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        todo={editingTodo}
        defaultQuadrant={defaultQuadrant}
        defaultTitle={defaultTitle}
        notes={notes}
      />
    </>
  );
}
