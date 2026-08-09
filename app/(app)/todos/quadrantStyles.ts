import { QUADRANT, QUADRANT_META } from '@/lib/constants';
import type { QuadrantMeta, TodoQuadrant } from '@/lib/types';

export interface QuadrantCardMeta extends QuadrantMeta {
  colorClass: string;
  headerClass: string;
}

// Semantic tokens only — the quadrant colours are defined in globals.css and
// registered in @theme inline, so light/dark is handled by the CSS variables.
const colorMap: Record<TodoQuadrant, { colorClass: string; headerClass: string }> = {
  [QUADRANT.DO]: {
    colorClass: 'bg-quadrant-do text-quadrant-do-foreground',
    headerClass: 'text-quadrant-do-foreground',
  },
  [QUADRANT.SCHEDULE]: {
    colorClass: 'bg-quadrant-schedule text-quadrant-schedule-foreground',
    headerClass: 'text-quadrant-schedule-foreground',
  },
  [QUADRANT.INBOX]: {
    colorClass: 'bg-quadrant-inbox text-quadrant-inbox-foreground',
    headerClass: 'text-quadrant-inbox-foreground',
  },
  [QUADRANT.PLANNED]: {
    colorClass: 'bg-quadrant-planned text-quadrant-planned-foreground',
    headerClass: 'text-quadrant-planned-foreground',
  },
};

export const quadrants: QuadrantCardMeta[] = QUADRANT_META.map((m) => ({
  ...m,
  ...colorMap[m.key],
}));
