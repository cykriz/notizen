'use client';

import { memo, useRef, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TodoCard } from './TodoCard';
import { createTodoAction, updateTodoAction } from './actions';
import { QUADRANT_META } from '@/lib/constants';
import type { QuadrantMeta, NoteSummary } from '@/lib/types';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';

interface QuadrantCardMeta extends QuadrantMeta {
  colorClass: string;
  headerClass: string;
}

const colorMap: Record<TodoQuadrant, { colorClass: string; headerClass: string }> = {
  do: { colorClass: 'bg-quadrant-do text-quadrant-do-foreground', headerClass: 'text-quadrant-do-foreground' },
  schedule: {
    colorClass: 'bg-quadrant-schedule text-quadrant-schedule-foreground',
    headerClass: 'text-quadrant-schedule-foreground',
  },
  delegate: {
    colorClass: 'bg-quadrant-delegate text-quadrant-delegate-foreground',
    headerClass: 'text-quadrant-delegate-foreground',
  },
  planned: {
    colorClass: 'bg-quadrant-planned text-quadrant-planned-foreground',
    headerClass: 'text-quadrant-planned-foreground',
  },
};

export const quadrants: QuadrantCardMeta[] = QUADRANT_META.map((m) => ({
  ...m,
  ...colorMap[m.key],
}));

interface QuadrantCardProps {
  meta: QuadrantCardMeta;
  todos: Todo[];
  onAdd: (quadrant: TodoQuadrant, title?: string) => void;
  onEdit: (todo: Todo) => void;
  notes: NoteSummary[];
}

export const QuadrantCard = memo(function QuadrantCard({ meta, todos, onAdd, onEdit, notes }: QuadrantCardProps) {
  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);
  const [inputValue, setInputValue] = useState('');
  const [, startTransition] = useTransition();

  const handleQuickAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      return;
    }

    setInputValue('');
    startTransition(async () => {
      await createTodoAction({ title: trimmed, quadrant: meta.key });
    });
  };

  const handleEditClick = () => {
    const title = inputValue.trim();
    setInputValue('');
    onAdd(meta.key, title !== '' ? title : undefined);
  };

  const [isDragTarget, setIsDragTarget] = useState(false);
  // Tracks nested dragEnter/dragLeave pairs to avoid flicker from child elements
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
      startTransition(async () => {
        await updateTodoAction(todoId, { quadrant: meta.key });
      });
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
          <CardTitle className={cn('text-sm font-semibold', meta.headerClass)}>{meta.label}</CardTitle>
          <p className={cn('text-xs opacity-75', meta.headerClass)}>{meta.description}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto mx-2 md:p-1.5 md:px-0">
        {open.length === 0 && done.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Keine Aufgaben</p>
        )}
        {open.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} />
        ))}
        {done.length > 0 && open.length > 0 && <div className="my-1 border-t" />}
        {done.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} />
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
