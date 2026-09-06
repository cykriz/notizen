'use client';

import { useState, useCallback, useMemo } from 'react';
import { TodoColumn } from './TodoColumn';
import { TodoRules } from './TodoRules';
import { todoColumns } from './todoColumnStyles';
import { TodoDialog } from './TodoDialog';
import { useFailedEntityIds } from '../useFailedEntityIds';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { QUADRANT, SYNC_ENTITY } from '@/lib/constants';
import { TODO_COLUMN, columnOf, quadrantOf } from '@/lib/todoColumns';
import { SHORTCUT } from '@/lib/globalShortcuts';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';
import type { NoteSummary, TodoColumnKey } from '@/lib/types';

// Mobile row sizing: Eingang and Erledigen get the tall rows, Erledigt the short
// one, so all three fit the viewport without scrolling the board itself.
const MOBILE_LARGE_WEIGHT = 5;
const MOBILE_SMALL_WEIGHT = 2;
const MOBILE_GAP_REM = 0.75; // must match gap-3
const VISIBLE_WEIGHT = 2 * MOBILE_LARGE_WEIGHT + MOBILE_SMALL_WEIGHT;
const VISIBLE_GAPS_REM = 2 * MOBILE_GAP_REM;

interface TodoBoardProps {
  todos: Todo[];
  notes: NoteSummary[];
}

export function TodoBoard({ todos, notes }: TodoBoardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>(undefined);
  const [defaultQuadrant, setDefaultQuadrant] = useState<TodoQuadrant>(QUADRANT.INBOX);
  const [defaultTitle, setDefaultTitle] = useState('');
  const [dialogKey, setDialogKey] = useState(0);
  const failedIds = useFailedEntityIds(SYNC_ENTITY.TODO);

  const todosByColumn = useMemo(() => {
    const map: Record<TodoColumnKey, Todo[]> = {
      [TODO_COLUMN.INBOX]: [],
      [TODO_COLUMN.DO]: [],
      [TODO_COLUMN.DONE]: [],
    };
    for (const t of todos) {
      map[columnOf(t)].push(t);
    }
    return map;
  }, [todos]);

  const handleAdd = useCallback((column: TodoColumnKey, title?: string) => {
    setEditingTodo(undefined);
    setDefaultQuadrant(quadrantOf(column));
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

  useGlobalShortcut(SHORTCUT.CREATE, () => {
    if (!dialogOpen) {
      handleAdd(TODO_COLUMN.INBOX);
    }
  });

  return (
    <>
      <TodoRules />
      <div
        className="grid grid-cols-1 md:grid-cols-3 grid-rows-[var(--row-lg)_var(--row-lg)_var(--row-sm)] md:grid-rows-1 gap-3 flex-1 min-h-0 overflow-y-auto py-2 px-3"
        style={
          {
            '--row-lg': `calc(${String(MOBILE_LARGE_WEIGHT)} * (100% - ${String(VISIBLE_GAPS_REM)}rem) / ${String(VISIBLE_WEIGHT)})`,
            '--row-sm': `calc(${String(MOBILE_SMALL_WEIGHT)} * (100% - ${String(VISIBLE_GAPS_REM)}rem) / ${String(VISIBLE_WEIGHT)})`,
          } as React.CSSProperties
        }
      >
        {todoColumns.map((meta) => (
          <TodoColumn
            key={meta.key}
            meta={meta}
            todos={todosByColumn[meta.key]}
            failedIds={failedIds}
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
