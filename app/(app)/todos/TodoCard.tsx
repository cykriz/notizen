'use client';

import { memo, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudAlert, FileText, AlignLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { QUADRANT } from '@/lib/constants';
import { canEnterDo, columnOf } from '@/lib/todoColumns';
import { FAILED_SYNC_CARD_LABEL, FAILED_SYNC_CARD_TOOLTIP } from '@/lib/failedSyncConstants';
import { useData } from '../dataContext';
import { useReportedTransition } from '../navigationLoading';
import type { Todo } from '@/lib/fsTodos';
import type { NoteSummary } from '@/lib/types';

interface TodoCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  notes: NoteSummary[];
  /** Sync for this todo failed permanently — it exists only on this device. */
  syncFailed?: boolean;
}

export const TodoCard = memo(function TodoCard({ todo, onEdit, notes, syncFailed = false }: TodoCardProps) {
  const { todos, updateTodo, deleteTodo } = useData();
  const router = useRouter();
  const startNavigation = useReportedTransition();
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Un-ticking is the fifth way into "Erledigen": the todo keeps its stored
   * quadrant while it sits in Erledigt, so clearing `completed` alone would put it
   * straight back into a column that may already be full. Writing the quadrant too
   * keeps the limit intact without blocking the click — a free slot returns the
   * todo to where it was, a full one parks it in Eingang.
   */
  const handleToggle = (checked: boolean) => {
    const patch = checked
      ? { completed: true }
      : {
        completed: false,
        quadrant: canEnterDo(todos, todo.id) ? todo.quadrant : QUADRANT.INBOX,
      };
    void updateTodo(todo.id, patch).catch(console.error);
  };

  const hasDescription = (todo.description?.trim().length ?? 0) > 0;

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
        // The COLUMN, not the stored quadrant: a completed todo still carries
        // quadrant 'inbox'/'do', so sending that would make the drop handler treat
        // a drag out of Erledigt as a drop onto its own column and ignore it.
        e.dataTransfer.setData('application/x-todo-column', columnOf(todo));
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
        <span className={cn('text-sm leading-tight mr-2', { 'line-through text-muted-foreground': todo.completed })}>
          {todo.title}
        </span>
        {hasDescription && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="mr-2 inline-flex align-middle text-muted-foreground"
                tabIndex={0}
                role="img"
                aria-label="Beschreibung vorhanden"
              >
                <AlignLeft className="h-3.5 w-3.5 shrink-0" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <span className="line-clamp-3">{todo.description}</span>
            </TooltipContent>
          </Tooltip>
        )}
        {syncFailed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="mr-2 text-xs px-1.5 py-0 gap-0.5" tabIndex={0}>
                <CloudAlert className="h-2.5 w-2.5" />
                {FAILED_SYNC_CARD_LABEL}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {FAILED_SYNC_CARD_TOOLTIP}
            </TooltipContent>
          </Tooltip>
        )}
        {linkedNotes.length > 0 && (
          <span className="inline-flex flex-wrap gap-1">
            {linkedNotes.map((n) => (
              <Badge
                key={n.id}
                variant="outline"
                className="text-xs px-1.5 py-0 gap-0.5 cursor-pointer hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  startNavigation(() => {
                    router.push(`/notes/${n.id}`);
                  });
                }}
              >
                <FileText className="h-2.5 w-2.5" />
                <span className="max-w-24 truncate">{n.title}</span>
              </Badge>
            ))}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${todo.title} löschen`}
        className="h-6 w-6 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity self-center"
        onClick={(e) => {
          e.stopPropagation();
          void deleteTodo(todo.id).catch(console.error);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});
