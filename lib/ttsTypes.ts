// Read-aloud (Text-to-Speech) types, split out of lib/types.ts — NOT for the
// 200-line limit, but because SpeechControls references SpeechSynthesisVoice, a
// DOM global. lib/types.ts is reachable from worker/ (via @/lib/constants and
// directly from worker/swPrecache.ts), and worker/tsconfig.json deliberately has
// lib: ["webworker", "esnext"] with no "dom" — so a DOM reference there breaks
// `bun run typecheck`. Same shape as lib/shareTypes.ts: a types-only sibling of
// lib/types.ts. SpeechRate / NeuralVoiceId are `typeof`-derived and stay in
// lib/ttsConstants.ts; imported here, not re-exported (see lib/types.ts).
import type { NeuralVoiceId, SpeechRate } from './ttsConstants';

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
