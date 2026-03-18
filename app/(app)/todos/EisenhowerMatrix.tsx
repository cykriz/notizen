'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { QuadrantCard, quadrants } from './QuadrantCard';
import { TodoDialog } from './TodoDialog';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';
import type { NoteSummary } from '@/lib/types';

// Mobile row sizing: first 3 rows (2 large + 1 small) fill the viewport, 4th scrolls below
const MOBILE_LARGE_WEIGHT = 5;
const MOBILE_SMALL_WEIGHT = 2;
const MOBILE_GAP_REM = 0.75; // must match gap-3
const VISIBLE_WEIGHT = 2 * MOBILE_LARGE_WEIGHT + MOBILE_SMALL_WEIGHT;
const VISIBLE_GAPS_REM = 2 * MOBILE_GAP_REM;

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
    const map: Record<TodoQuadrant, Todo[]> = { do: [], schedule: [], delegate: [], planned: [] };
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!dialogOpen) {
          handleAdd('do');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialogOpen, handleAdd]);

  return (
    <>
      <div
        className="grid grid-cols-1 md:grid-cols-2 grid-rows-[var(--row-lg)_var(--row-lg)_var(--row-sm)_var(--row-sm)] md:grid-rows-2 gap-3 flex-1 min-h-0 overflow-y-auto py-2 px-3"
        style={
          {
            '--row-lg': `calc(${String(MOBILE_LARGE_WEIGHT)} * (100% - ${String(VISIBLE_GAPS_REM)}rem) / ${String(VISIBLE_WEIGHT)})`,
            '--row-sm': `calc(${String(MOBILE_SMALL_WEIGHT)} * (100% - ${String(VISIBLE_GAPS_REM)}rem) / ${String(VISIBLE_WEIGHT)})`,
          } as React.CSSProperties
        }
      >
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
