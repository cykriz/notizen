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

export const todoColumns: TodoColumnCardMeta[] = TODO_COLUMN_META.map((m) => ({
  ...m,
  ...colorMap[m.key],
}));
