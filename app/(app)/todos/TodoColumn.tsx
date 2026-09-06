'use client';

import { memo, useRef, useState } from 'react';
import { ListFilter, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TodoCard } from './TodoCard';
import { useData } from '../dataContext';
import { INBOX_SORT_HINT, INBOX_SORT_THRESHOLD } from '@/lib/constants';
import {
  ADD_DETAILED_LABEL,
  CLEAR_DONE_LABEL,
  DO_FULL_PLACEHOLDER,
  TODO_COLUMN,
  canDrop,
  canEnterDo,
  quadrantOf,
} from '@/lib/todoColumns';
import type { NoteSummary, TodoColumnKey } from '@/lib/types';
import type { Todo } from '@/lib/fsTodos';
import type { TodoColumnCardMeta } from './todoColumnStyles';

interface TodoColumnProps {
  meta: TodoColumnCardMeta;
  todos: Todo[];
  onAdd: (column: TodoColumnKey, title?: string) => void;
  onEdit: (todo: Todo) => void;
  notes: NoteSummary[];
  /** Ids whose sync has permanently failed — rendered as a badge on the card. */
  failedIds: ReadonlySet<string>;
}

/** The write a drop onto this column implies. */
function patchForColumn(key: TodoColumnKey): Partial<Todo> {
  return key === TODO_COLUMN.DONE ? { completed: true } : { completed: false, quadrant: quadrantOf(key) };
}

export const TodoColumn = memo(function TodoColumn({
  meta,
  todos,
  onAdd,
  onEdit,
  notes,
  failedIds,
}: TodoColumnProps) {
  const { todos: allTodos, createTodo, updateTodo, deleteTodo } = useData();
  const isDone = meta.key === TODO_COLUMN.DONE;
  const showSortHint = meta.key === TODO_COLUMN.INBOX && todos.length >= INBOX_SORT_THRESHOLD;
  // Blocked only for the Erledigen column, and only for todos not already in it.
  const blocked = meta.key === TODO_COLUMN.DO && !canEnterDo(allTodos);
  const [inputValue, setInputValue] = useState('');

  const handleQuickAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed === '' || blocked) {
      return;
    }

    setInputValue('');
    void createTodo({ title: trimmed, quadrant: quadrantOf(meta.key) }).catch(console.error);
  };

  const handleEditClick = () => {
    const title = inputValue.trim();
    setInputValue('');
    onAdd(meta.key, title !== '' ? title : undefined);
  };

  const handleClearDone = () => {
    for (const t of todos) {
      void deleteTodo(t.id).catch(console.error);
    }
  };

  const [isDragTarget, setIsDragTarget] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragTarget(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = blocked ? 'none' : 'move';
  };

  const handleDragLeave = () => {
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragTarget(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragTarget(false);
    const todoId = e.dataTransfer.getData('application/x-todo-id');
    const fromColumn = e.dataTransfer.getData('application/x-todo-column');
    if (!canDrop(allTodos, todoId, fromColumn, meta.key)) {
      return;
    }

    void updateTodo(todoId, patchForColumn(meta.key)).catch(console.error);
  };

  return (
    <Card
      className={cn('flex flex-col min-h-0 overflow-hidden gap-0 py-0', {
        'ring-2 ring-primary/50': isDragTarget && !blocked,
        'ring-2 ring-destructive': isDragTarget && blocked,
      })}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* `flex` statt `flex-row`: CardHeader bringt `grid` mit, und twMerge räumt das
          nur über dieselbe Klassen-Gruppe (display) ab — `flex-row` allein bliebe auf
          einem Grid inert und der Zähler landete in einer zweiten Zeile. Die Grid-Reste der
          Basis (`auto-rows-min`, `grid-rows-*`, `has-data-[slot=card-action]:grid-cols-*`) überleben den
          Merge und bleiben hier folgenlos inert — kein Aufrufer kann sie entfernen. */}
      <CardHeader className={cn('flex items-center gap-2 py-2.5 px-3', meta.colorClass)}>
        <div className="flex md:flex-col items-baseline gap-2 md:gap-0 min-w-0">
          <CardTitle className={cn('flex items-baseline gap-1.5 text-sm font-semibold min-w-0', meta.headerClass)}>
            <span aria-hidden="true">{meta.icon}</span>
            <span className="truncate min-w-0">{meta.label}</span>
            {meta.limit !== undefined && <span className="shrink-0 font-normal opacity-75">(max. {meta.limit})</span>}
          </CardTitle>
          <p className={cn('text-xs opacity-75 truncate min-w-0', meta.headerClass)}>{meta.description}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {showSortHint && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              <ListFilter className="h-3 w-3" />
              {INBOX_SORT_HINT}
            </span>
          )}
          {isDone && todos.length > 0 && (
            <Button
              size="xs"
              variant="ghost"
              className={cn('gap-1 px-1.5', meta.headerClass)}
              onClick={handleClearDone}
            >
              <Trash2 className="h-3 w-3" />
              {todos.length} {CLEAR_DONE_LABEL}
            </Button>
          )}
          {!isDone && todos.length > 0 && (
            <span className={cn('text-xs font-medium tabular-nums opacity-75', meta.headerClass)}>{todos.length}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto mx-2 md:p-1.5 md:px-0">
        {todos.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Keine Aufgaben</p>}
        {todos.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} syncFailed={failedIds.has(t.id)} />
        ))}
      </CardContent>
      {!isDone && (
        <div className="flex items-center gap-1 border-t px-2 py-1">
          <Input
            value={inputValue}
            disabled={blocked}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleQuickAdd();
              }
            }}
            placeholder={blocked ? DO_FULL_PLACEHOLDER : 'Neue Aufgabe…'}
            className="h-7 border-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:border-0 px-1"
          />
          <Button
            size="icon-xs"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            aria-label={ADD_DETAILED_LABEL}
            disabled={blocked}
            onClick={handleEditClick}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </Card>
  );
});
