import type { PreviewMode, QuadrantMeta } from './types';

export const DEFAULT_NOTE_TITLE = 'Unbenannt';

export const PREVIEW_MODES: readonly PreviewMode[] = ['edit', 'preview'];
export const PREVIEW_EDIT: PreviewMode = 'edit';
export const PREVIEW_PREVIEW: PreviewMode = 'preview';

export const QUADRANT = {
  DO: 'do',
  SCHEDULE: 'schedule',
  DELEGATE: 'delegate',
  PLANNED: 'planned',
} as const;

export type TodoQuadrant = (typeof QUADRANT)[keyof typeof QUADRANT];

export const QUADRANT_KEYS = Object.values(QUADRANT);

export const QUADRANT_META: readonly QuadrantMeta[] = [
  { key: QUADRANT.DO, label: 'Erledigen', description: 'Wichtig & Dringend' },
  { key: QUADRANT.SCHEDULE, label: 'Einplanen', description: 'Wichtig & Nicht dringend' },
  { key: QUADRANT.DELEGATE, label: 'Delegieren', description: 'Nicht wichtig & Dringend' },
  { key: QUADRANT.PLANNED, label: 'Eingeplant', description: 'Nicht wichtig & Nicht dringend' },
];
