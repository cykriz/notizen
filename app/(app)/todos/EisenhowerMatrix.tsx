'use client';

import { useState, useCallback, useMemo } from 'react';
import { QuadrantCard } from './QuadrantCard';
import { quadrants } from './quadrantStyles';
import { TodoDialog } from './TodoDialog';
import { useFailedEntityIds } from '../useFailedEntityIds';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { QUADRANT, SYNC_ENTITY } from '@/lib/constants';
import { SHORTCUT } from '@/lib/globalShortcuts';
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
  const [defaultQuadrant, setDefaultQuadrant] = useState<TodoQuadrant>(QUADRANT.INBOX);
  const [defaultTitle, setDefaultTitle] = useState('');
  const [dialogKey, setDialogKey] = useState(0);
  const [focusDueDate, setFocusDueDate] = useState(false);
  const failedIds = useFailedEntityIds(SYNC_ENTITY.TODO);

  const todosByQuadrant = useMemo(() => {
    const map: Record<TodoQuadrant, Todo[]> = {
      [QUADRANT.DO]: [],
      [QUADRANT.SCHEDULE]: [],
      [QUADRANT.INBOX]: [],
      [QUADRANT.PLANNED]: [],
    };
    for (const t of todos) {
      map[t.quadrant].push(t);
    }
    return map;
  }, [todos]);

  const handleAdd = useCallback((quadrant: TodoQuadrant, title?: string) => {
    setEditingTodo(undefined);
    setDefaultQuadrant(quadrant);
    setDefaultTitle(title ?? '');
    setFocusDueDate(false);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setDefaultQuadrant(todo.quadrant);
    setFocusDueDate(false);
    setDialogOpen(true);
  }, []);

  const handleRequireDueDate = useCallback(
    (todoId: string) => {
      const todo = todos.find((t) => t.id === todoId);
      if (!todo) {
        return;
      }

      setEditingTodo({ ...todo, quadrant: QUADRANT.PLANNED });
      setDefaultQuadrant(QUADRANT.PLANNED);
      setFocusDueDate(true);
      setDialogKey((k) => k + 1);
      setDialogOpen(true);
    },
    [todos],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTodo(undefined);
    }
  }, []);

  useGlobalShortcut(SHORTCUT.CREATE, () => {
    if (!dialogOpen) {
      handleAdd(QUADRANT.INBOX);
    }
  });

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
            failedIds={failedIds}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onRequireDueDate={handleRequireDueDate}
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
        autoFocusDueDate={focusDueDate}
        notes={notes}
      />
    </>
  );
}
