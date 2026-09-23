'use client';

import { useCallback, useRef, useState } from 'react';
import {
  TODO_COLUMN,
  TODO_COLUMN_DRAG_MIME,
  TODO_DRAG_MIME,
  canDrop,
  quadrantOf,
} from '@/lib/todoColumns';
import { inboxDropRank } from '@/lib/todoOrder';
import type { Todo } from '@/lib/fsTodos';
import type { UpdateTodoInput } from '@/lib/offlineTodos';
import type { TodoColumnKey } from '@/lib/types';

// The column's drag & drop state machine, extracted from TodoColumn.tsx to keep it
// under the 200-line cap once the reorder sensors were added.

interface UseTodoColumnDropArgs {
  columnKey: TodoColumnKey;
  /** Every todo, not just this column's — canDrop and inboxDropRank bucket themselves. */
  allTodos: Todo[];
  blocked: boolean;
  /** The todo currently being dragged, board-wide — null when nothing is. */
  draggingId: string | null;
  updateTodo: (id: string, input: UpdateTodoInput) => Promise<void>;
}

/** Distinct from `null`, which is the real slot below the last card. */
const NO_SLOT = Symbol('no lit slot');

/** The write a drop onto this column implies, position aside. */
function patchForColumn(key: TodoColumnKey): Partial<Todo> {
  return key === TODO_COLUMN.DONE ? { completed: true } : { completed: false, quadrant: quadrantOf(key) };
}

export function useTodoColumnDrop({
  columnKey,
  allTodos,
  blocked,
  draggingId,
  updateTodo,
}: UseTodoColumnDropArgs) {
  const [isDragTarget, setIsDragTarget] = useState(false);
  const [dropBeforeId, setDropBeforeId] = useState<string | null>(null);
  const dragCounter = useRef(0);
  // Mirrored in a ref because the last dragover and the drop can land in the same
  // React batch, where reading the state would yield the previous position.
  const dropBeforeIdRef = useRef<string | null>(null);

  // Only Eingang is manually ordered, so only its cards act as position sensors.
  const sortable = columnKey === TODO_COLUMN.INBOX;

  const trackDropBefore = useCallback((id: string | null) => {
    dropBeforeIdRef.current = id;
    // Fires every few ms while hovering — bail out instead of re-rendering the column.
    setDropBeforeId((prev) => (prev === id ? prev : id));
  }, []);

  // No stopPropagation anywhere below: dragCounter deliberately counts the enter and
  // leave events of descendants, and one swallowed dragenter without its dragleave
  // would leave the highlight ring stuck on.
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
      trackDropBefore(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragTarget(false);
    const beforeId = dropBeforeIdRef.current;
    trackDropBefore(null);

    const todoId = e.dataTransfer.getData(TODO_DRAG_MIME);
    const fromColumn = e.dataTransfer.getData(TODO_COLUMN_DRAG_MIME);
    // canDrop rejects fromColumn === column, which is exactly a reorder — so that one
    // case is decided here rather than by relaxing a rule the other columns rely on.
    // canDrop carries its own empty-id guard for its other callers, but the reorder
    // branch below bypasses canDrop entirely — so this one has to stand on its own.
    if (todoId === '') {
      return;
    }

    const isReorder = sortable && fromColumn === columnKey;
    if (!isReorder && !canDrop(allTodos, todoId, fromColumn, columnKey)) {
      return;
    }

    if (!sortable) {
      void updateTodo(todoId, patchForColumn(columnKey)).catch(console.error);
      return;
    }

    const order = inboxDropRank(allTodos, beforeId, todoId);
    if (isReorder) {
      // null means the row already sits there, so there is nothing to write.
      if (order !== null) {
        void updateTodo(todoId, { order }).catch(console.error);
      }

      return;
    }

    // A row arriving from another column is not in this column's list yet, so the rank
    // is never null here — the guard is kept so a future caller cannot write `null`.
    void updateTodo(todoId, { ...patchForColumn(columnKey), ...(order !== null && { order }) })
      .catch(console.error);
  };

  /**
   * Whether the drop marker above `id` is lit — `null` is the slot below the last card.
   * Resolved once per render: at most one slot can be lit, and asking per marker would
   * sort the column N+1 times.
   *
   * Two gates, two jobs: isDragTarget clears the marker when the pointer leaves the
   * column, draggingId when the drag ends anywhere — including an ESC cancel, which
   * fires dragend on the source card. The rank check is what keeps the marker honest:
   * a drop onto the position the row already occupies writes nothing, so promising
   * one there would be a lie. Same call the drop handler makes.
   */
  const litSlot = sortable && isDragTarget && draggingId !== null
    && inboxDropRank(allTodos, dropBeforeId, draggingId) !== null
    ? dropBeforeId
    : NO_SLOT;
  const marks = (id: string | null) => litSlot !== NO_SLOT && litSlot === id;

  return {
    marks,
    isDragTarget,
    onDropBefore: trackDropBefore,
    sortable,
    columnProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
