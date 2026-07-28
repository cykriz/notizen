export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
  tags: string[];
  pinned: boolean;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  relativePath: string;
}

export interface Note extends NoteSummary {
  content: string;
  attachments: Attachment[];
}

export type PreviewMode = 'edit' | 'preview';

// TodoQuadrant, SpeechRate and NeuralVoiceId are derived from const values via
// `typeof`, so the types live next to those values. Re-exported here so
// consumers can import all types from '@/lib/types'.
import type { TodoQuadrant } from './constants';
import type { NeuralVoiceId, SpeechRate } from './ttsConstants';
export type { NeuralVoiceId, SpeechRate, TodoQuadrant };

// Read-aloud (text-to-speech) playback state machine. The neural engine adds a
// 'loading' state (model download / synthesis before audio starts).
export type SpeechState = 'idle' | 'playing' | 'paused';
export type ReadAloudState = SpeechState | 'loading';

// Why a neural play() failed: 'load' = the first chunk / model couldn't load
// (nothing played yet → fall back to the system voice); 'chunk' = a later chunk
// failed mid-note (already stopped → just show a notice, no restart).
export type ReadAloudErrorKind = 'load' | 'chunk';

// Which read-aloud engine is active: fast OS voices vs. natural neural (Piper).
export type TtsEngine = 'system' | 'neural';

// Return shape of the useSpeech hook (kept here so the hook file stays lean).
export interface SpeechControls {
  // Hydration-safe: false on the server + first client render, then flips true.
  supported: boolean;
  state: SpeechState;
  rate: SpeechRate;
  // Available German voices (most natural first) and the chosen one's voiceURI.
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  setVoiceURI: (uri: string) => void;
  setRate: (rate: SpeechRate) => void;
  play: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  cycleRate: () => void;
}

// Return shape of the useNeuralSpeech hook (Piper / vits-web engine).
export interface NeuralSpeechControls {
  supported: boolean;
  state: ReadAloudState;
  rate: SpeechRate;
  // Model download progress (0..1) while state is 'loading', else null.
  progress: number | null;
  voiceId: NeuralVoiceId;
  setVoiceId: (id: NeuralVoiceId) => void;
  // onError fires when a play attempt fails; `kind` distinguishes an initial
  // load failure (fall back to system) from a mid-note chunk failure (notice only).
  play: (text: string, onError?: (kind: ReadAloudErrorKind) => void) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  cycleRate: () => void;
}

export type SyncEntityType = 'note' | 'todo';
export type SyncAction = 'create' | 'update' | 'delete';

export interface QuadrantMeta {
  key: TodoQuadrant;
  label: string;
  description: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  linkedNoteIds?: string[];
  quadrant: TodoQuadrant;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  // ISO timestamp set when the todo is moved to the trash (soft-delete flag).
  // listTodos/getTodo hide entries carrying it, so it never reaches the active client cache.
  trashedAt?: string;
}

// Items in the trash always carry a trashedAt timestamp (used for display + auto-purge).
export type TrashedNote = NoteSummary & { trashedAt: string };
export type TrashedTodo = Todo & { trashedAt: string };

export interface UserSettings {
  retentionDays: number;
}

export interface TrashResponse {
  retentionDays: number;
  notes: TrashedNote[];
  todos: TrashedTodo[];
}
