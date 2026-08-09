'use client';

import { memo, useRef, useState } from 'react';
import { ListFilter, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TodoCard } from './TodoCard';
import { useData } from '../dataContext';
import { INBOX_SORT_HINT, INBOX_SORT_THRESHOLD, QUADRANT } from '@/lib/constants';
import type { NoteSummary } from '@/lib/types';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';
import type { QuadrantCardMeta } from './quadrantStyles';

interface QuadrantCardProps {
  meta: QuadrantCardMeta;
  todos: Todo[];
  onAdd: (quadrant: TodoQuadrant, title?: string) => void;
  onEdit: (todo: Todo) => void;
  onRequireDueDate?: (todoId: string) => void;
  notes: NoteSummary[];
  /** Ids whose sync has permanently failed — rendered as a badge on the card. */
  failedIds: ReadonlySet<string>;
}

export const QuadrantCard = memo(function QuadrantCard({
  meta,
  todos,
  onAdd,
  onEdit,
  onRequireDueDate,
  notes,
  failedIds,
}: QuadrantCardProps) {
  const { createTodo, updateTodo } = useData();
  const openTodos = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);
  const showSortHint = meta.key === QUADRANT.INBOX && openTodos.length >= INBOX_SORT_THRESHOLD;
  const [inputValue, setInputValue] = useState('');

  const handleQuickAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      return;
    }

    setInputValue('');
    void createTodo({ title: trimmed, quadrant: meta.key }).catch(console.error);
  };

  const handleEditClick = () => {
    const title = inputValue.trim();
    setInputValue('');
    onAdd(meta.key, title !== '' ? title : undefined);
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
    e.dataTransfer.dropEffect = 'move';
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
    const fromQuadrant = e.dataTransfer.getData('application/x-todo-quadrant');
    if (todoId !== '' && fromQuadrant !== meta.key) {
      const hasDue = e.dataTransfer.getData('application/x-todo-has-due') === '1';

      if (meta.key === QUADRANT.PLANNED && !hasDue && onRequireDueDate) {
        void updateTodo(todoId, { quadrant: meta.key }).catch(console.error);
        onRequireDueDate(todoId);
        return;
      }

      void updateTodo(todoId, { quadrant: meta.key }).catch(console.error);
    }
  };

  return (
    <Card
      className={cn('flex flex-col min-h-0 overflow-hidden gap-0 py-0', {
        'ring-2 ring-primary/50': isDragTarget,
      })}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className={cn('flex-row items-center gap-2 py-2.5 px-3', meta.colorClass)}>
        <div className="flex md:flex-col items-baseline gap-2 md:gap-0 min-w-0">
          <CardTitle className={cn('text-sm font-semibold truncate min-w-0', meta.headerClass)}>{meta.label}</CardTitle>
          <p className={cn('text-xs opacity-75 truncate min-w-0', meta.headerClass)}>{meta.description}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {showSortHint && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              <ListFilter className="h-3 w-3" />
              {INBOX_SORT_HINT}
            </span>
          )}
          {openTodos.length > 0 && (
            <span className={cn('text-xs font-medium tabular-nums opacity-75', meta.headerClass)}>
              {openTodos.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto mx-2 md:p-1.5 md:px-0">
        {openTodos.length === 0 && done.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Keine Aufgaben</p>
        )}
        {openTodos.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} syncFailed={failedIds.has(t.id)} />
        ))}
        {done.length > 0 && openTodos.length > 0 && <div className="my-1 border-t" />}
        {done.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} syncFailed={failedIds.has(t.id)} />
        ))}
      </CardContent>
      <div className="flex items-center gap-1 border-t px-2 py-1">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleQuickAdd();
            }
          }}
          placeholder="Neue Aufgabe…"
          className="h-7 border-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:border-0 px-1"
        />
        <Button size="icon-xs" variant="ghost" className="shrink-0 text-muted-foreground" onClick={handleEditClick}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
});
