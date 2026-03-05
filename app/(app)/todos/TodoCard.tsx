'use client';

import { memo, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { toggleTodoAction } from './actions';
import type { Todo } from '@/lib/fsTodos';
import type { NoteSummary } from '@/lib/types';

interface TodoCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  notes: NoteSummary[];
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

export const TodoCard = memo(function TodoCard({ todo, onEdit, notes }: TodoCardProps) {
  const [, startToggle] = useTransition();
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);

  const handleToggle = (checked: boolean) => {
    startToggle(async () => {
      await toggleTodoAction(todo.id, checked);
    });
  };

  const linkedNotes = useMemo(
    () =>
      (todo.linkedNoteIds ?? [])
        .map((nid) => notes.find((n) => n.id === nid))
        .filter((n): n is NoteSummary => n !== undefined),
    [todo.linkedNoteIds, notes],
  );

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md px-2.5 py-2 md:px-2 md:py-1.5 hover:bg-accent/50 cursor-pointer',
        { 'opacity-50': isDragging },
      )}
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('application/x-todo-id', todo.id);
        e.dataTransfer.setData('application/x-todo-quadrant', todo.quadrant);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        setIsDragging(false);
      }}
      onClick={() => {
        onEdit(todo);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(todo);
        }
      }}
    >
      <div
        className="pt-0.5"
        onClick={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="presentation"
      >
        <Checkbox
          checked={todo.completed}
          onCheckedChange={(checked) => {
            handleToggle(checked === true);
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm leading-tight', { 'line-through text-muted-foreground': todo.completed })}>
          {todo.title}
        </span>
        {todo.dueDate !== undefined && (
          <Badge
            variant={!todo.completed && isOverdue(todo.dueDate) ? 'destructive' : 'secondary'}
            className="ml-2 text-xs px-1.5 py-0"
          >
            <Calendar className="h-2.5 w-2.5 mr-0.5" />
            {formatDate(todo.dueDate)}
          </Badge>
        )}
        {linkedNotes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {linkedNotes.map((n) => (
              <Badge
                key={n.id}
                variant="outline"
                className="text-xs px-1.5 py-0 gap-0.5 cursor-pointer hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/notes/${n.id}`);
                }}
              >
                <FileText className="h-2.5 w-2.5" />
                <span className="max-w-24 truncate">{n.title}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
