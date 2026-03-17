import type { PreviewMode, TodoQuadrant, QuadrantMeta } from './types';

export const DEFAULT_NOTE_TITLE = 'Unbenannt';

export const PREVIEW_MODES: readonly PreviewMode[] = ['edit', 'preview'];
export const PREVIEW_EDIT: PreviewMode = 'edit';
export const PREVIEW_PREVIEW: PreviewMode = 'preview';

export const QUADRANT_KEYS = [
  'do', 'schedule', 'delegate', 'eliminate',
] as const satisfies readonly TodoQuadrant[];

export const QUADRANT_META: readonly QuadrantMeta[] = [
  { key: 'do', label: 'Erledigen', description: 'Wichtig & Dringend' },
  { key: 'schedule', label: 'Einplanen', description: 'Wichtig & Nicht dringend' },
  { key: 'delegate', label: 'Delegieren', description: 'Nicht wichtig & Dringend' },
  { key: 'eliminate', label: 'Verwerfen', description: 'Nicht wichtig & Nicht dringend' },
];
