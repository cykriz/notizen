import { TODO_COLUMN, TODO_COLUMN_META } from '@/lib/todoColumns';
import type { TodoColumnKey, TodoColumnMeta } from '@/lib/types';

export interface TodoColumnCardMeta extends TodoColumnMeta {
  colorClass: string;
  headerClass: string;
}

// Semantic tokens only — the column colours are defined in globals.css and
// registered in @theme inline, so light/dark is handled by the CSS variables.
const colorMap: Record<TodoColumnKey, { colorClass: string; headerClass: string }> = {
  [TODO_COLUMN.INBOX]: {
    colorClass: 'bg-quadrant-inbox text-quadrant-inbox-foreground',
    headerClass: 'text-quadrant-inbox-foreground',
  },
  [TODO_COLUMN.DO]: {
    colorClass: 'bg-quadrant-do text-quadrant-do-foreground',
    headerClass: 'text-quadrant-do-foreground',
  },
  [TODO_COLUMN.DONE]: {
    colorClass: 'bg-quadrant-done text-quadrant-done-foreground',
    headerClass: 'text-quadrant-done-foreground',
  },
};

/**
 * The drop marker: one slot ABOVE every card plus one below the last, so every
 * insertion point has the same element and there is no second copy to drift.
 *
 * Rendered in all three columns, although only Eingang can ever light one: the space
 * it reserves sets the gap between cards, so dropping it from the other two would
 * give them a different rhythm.
 *
 * A bar with its own height rather than a border on the card: a browser caps a
 * border-radius at half the box height, so anything thinner renders with visibly
 * square ends — h-1 buys the 2px radius that makes the ends read as round.
 * The slot always occupies its height, so lighting it cannot shift the list.
 */
export const TODO_DROP_MARKER = 'h-1 rounded-full';

export const todoColumns: TodoColumnCardMeta[] = TODO_COLUMN_META.map((m) => ({
  ...m,
  ...colorMap[m.key],
}));
