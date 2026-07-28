// Read-aloud (Text-to-Speech) constants, split out of lib/constants.ts to keep
// that file under the 200-line limit. SpeechRate / NeuralVoiceId are `typeof`-
// derived, so they live next to their values and are re-exported from types.ts.

// Playback rates offered by the read-aloud speed cycle button.
export const SPEECH_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];
export const DEFAULT_SPEECH_RATE: SpeechRate = 1;

// Next rate in the cycle, wrapping around (shared by both engines).
export function nextSpeechRate(rate: SpeechRate): SpeechRate {
  return SPEECH_RATES[(SPEECH_RATES.indexOf(rate) + 1) % SPEECH_RATES.length];
}
export const SPEECH_LANG = 'de-DE';

// Max characters per spoken chunk (system engine) — under Chrome's silent-cutoff
// for very long utterances (the ~15s auto-pause is handled by the keep-alive).
export const SPEECH_CHUNK_MAX = 2000;

// Neural (Piper) synthesizes each chunk in one WASM pass; the whole note at once
// overruns the model's memory and aborts onnxruntime. Keep chunks small (~a
// paragraph); the next chunk is pre-synthesized during playback → no gaps.
export const NEURAL_CHUNK_MAX = 500;

// How many upcoming chunks to pre-synthesize during playback. 2 (not 1) so a
// short chunk — e.g. a heading that plays for ~1s — doesn't starve the pipeline:
// the chunk after it is already synthesized during the previous long chunk.
export const NEURAL_LOOKAHEAD = 2;

// localStorage keys for read-aloud preferences (persisted client-side).
export const SPEECH_VOICE_STORAGE_KEY = 'notizen:tts-voice'; // system (Web Speech) voiceURI
export const NEURAL_VOICE_STORAGE_KEY = 'notizen:tts-neural-voice'; // neural (Piper) voiceId
export const TTS_ENGINE_STORAGE_KEY = 'notizen:tts-engine'; // 'system' | 'neural'

// Neural (Piper / vits-web) German voices offered in the picker. Models download
// from HuggingFace on first use and cache in OPFS.
//
// IMPORTANT: only `phoneme_type: espeak` / num_symbols=256 models. vits-web's
// phonemizer emits espeak phoneme ids (up to ~150), so the older num_symbols=130
// German voices (kerstin, eva_k, ramona, karlsson, pavoque) overflow their
// embedding table and crash onnxruntime. Thorsten is the only compatible set.
export const NEURAL_VOICES = [
  { id: 'de_DE-thorsten-medium', label: 'Thorsten' },
  { id: 'de_DE-thorsten-high', label: 'Thorsten (HD)' },
  { id: 'de_DE-thorsten_emotional-medium', label: 'Thorsten (emotional)' },
] as const;
export type NeuralVoiceId = (typeof NEURAL_VOICES)[number]['id'];
export const DEFAULT_NEURAL_VOICE: NeuralVoiceId = 'de_DE-thorsten-medium';

// German UI strings (single-sourced, never inline in components).
export const READ_ALOUD_START_LABEL = 'Vorlesen';
export const READ_ALOUD_PAUSE_LABEL = 'Pausieren';
export const READ_ALOUD_RESUME_LABEL = 'Fortsetzen';
export const READ_ALOUD_STOP_LABEL = 'Vorlesen beenden';
export const READ_ALOUD_SPEED_LABEL = 'Vorlesegeschwindigkeit';
export const READ_ALOUD_VOICE_LABEL = 'Stimme';
export const READ_ALOUD_ENGINE_LABEL = 'Qualität';
export const READ_ALOUD_ENGINE_SYSTEM = 'System (schnell)';
export const READ_ALOUD_ENGINE_NEURAL = 'Natürlich (KI)';
export const READ_ALOUD_LOADING_LABEL = 'Stimme wird geladen…';
export const READ_ALOUD_FALLBACK_NOTICE = 'Natürliche Stimme nicht verfügbar – Systemstimme verwendet.';
export const READ_ALOUD_ERROR_NOTICE = 'Vorlesen abgebrochen – Fehler bei der Sprachsynthese.';
