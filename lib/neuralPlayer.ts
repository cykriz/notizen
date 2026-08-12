import {
  DEFAULT_NEURAL_VOICE,
  DEFAULT_SPEECH_RATE,
  NEURAL_CHUNK_MAX,
  NEURAL_LOOKAHEAD,
  nextSpeechRate,
  type NeuralVoiceId,
  type SpeechRate,
} from '@/lib/ttsConstants';
import type { ReadAloudErrorKind, ReadAloudState } from '@/lib/ttsTypes';
import { splitIntoSpeechChunks } from '@/lib/markdownToPlainText';
import { silentWavDataUri } from '@/lib/silentWav';
// synthChunk runs the heavy WASM synthesis in a Web Worker (off the main thread),
// so the UI stays responsive while chunks are (pre)synthesized.
import { synthChunk } from '@/lib/neuralTtsClient';

interface PlayerCallbacks {
  onState: (state: ReadAloudState) => void;
  onProgress: (progress: number | null) => void;
}

/**
 * Plays neural TTS through one <audio> element. Splits text into small chunks
 * (whole-note synthesis overruns the model) and pre-synthesizes the current +
 * next NEURAL_LOOKAHEAD chunks during playback, so transitions stay gapless even
 * when a chunk is short (e.g. a heading).
 */
export class NeuralPlayer {
  readonly audio: HTMLAudioElement;
  rate: SpeechRate = DEFAULT_SPEECH_RATE;
  voiceId: NeuralVoiceId = DEFAULT_NEURAL_VOICE;
  private chunks: string[] = [];
  private gen = 0;
  private url: string | null = null;
  private onError?: (kind: ReadAloudErrorKind) => void;
  // index → in-flight/resolved synthesis, memoized so each chunk is synthesized once.
  private readonly blobs = new Map<number, Promise<Blob>>();

  constructor(private readonly cb: PlayerCallbacks) {
    this.audio = new Audio();
    this.audio.preservesPitch = true;
  }

  play(text: string, onError?: (kind: ReadAloudErrorKind) => void): void {
    const chunks = splitIntoSpeechChunks(text, NEURAL_CHUNK_MAX);
    if (chunks.length === 0) {
      return;
    }

    this.onError = onError;
    this.gen += 1;
    const gen = this.gen;
    // Unlock the element within the click gesture so the async play() below is
    // not rejected by the autoplay policy (which would force a silent fallback).
    this.audio.onended = null;
    this.audio.src = silentWavDataUri();
    void this.audio.play().catch(() => undefined);
    this.chunks = chunks;
    this.blobs.clear();
    this.cb.onState('loading');

    // Synthesize chunk 0 with the download-progress callback (first use fetches
    // the model). A failure here means the engine can't run → fall back to system.
    const first = synthChunk(chunks[0], this.voiceId, (p) => {
      if (gen === this.gen && p.total > 0) {
        this.cb.onProgress(p.loaded / p.total);
      }
    });
    first.catch(() => undefined); // parked; awaited below
    this.blobs.set(0, first);
    first
      .then(() => {
        this.cb.onProgress(null);
        if (gen === this.gen) {
          this.advance(gen, 0);
        }
      })
      .catch((err: unknown) => {
        if (gen !== this.gen) {
          return;
        }

        console.error('[read-aloud] neural failed → falling back to system voice:', err);
        this.cb.onProgress(null);
        this.cb.onState('idle');
        this.onError?.('load');
      });
  }

  // Kick off synthesis for a chunk (memoized), unless already started or out of range.
  private synthAt(index: number): void {
    if (index >= this.chunks.length || this.blobs.has(index)) {
      return;
    }

    const promise = synthChunk(this.chunks[index], this.voiceId);
    promise.catch(() => undefined); // parked; advance() awaits + handles errors
    this.blobs.set(index, promise);
  }

  // Ensure current + next NEURAL_LOOKAHEAD chunks are synthesizing, then play
  // `index` once ready and chain to the next when it ends.
  private advance(gen: number, index: number): void {
    if (gen !== this.gen || index >= this.chunks.length) {
      this.cb.onState('idle');
      return;
    }

    for (let ahead = index; ahead <= index + NEURAL_LOOKAHEAD; ahead++) {
      this.synthAt(ahead);
    }

    this.blobs
      .get(index)
      ?.then((blob) => {
        if (gen === this.gen) {
          this.playBlob(gen, index, blob);
        }
      })
      .catch((err: unknown) => {
        if (gen === this.gen) {
          console.error('[read-aloud] chunk failed mid-note:', err);
          this.cb.onState('idle');
          this.onError?.('chunk');
        }
      });
  }

  private playBlob(gen: number, index: number, blob: Blob): void {
    const audio = this.audio;
    this.blobs.delete(index); // consumed
    if (this.url !== null) {
      URL.revokeObjectURL(this.url);
    }

    this.url = URL.createObjectURL(blob);
    audio.onended = () => {
      if (gen === this.gen) {
        this.advance(gen, index + 1);
      }
    };
    audio.src = this.url;
    audio.playbackRate = this.rate;

    // Start only once decoded, else the media clock advances during decode and
    // swallows the first ~second of the chunk.
    const start = () => {
      if (gen !== this.gen) {
        return;
      }

      this.cb.onState('playing');
      void audio.play().catch(() => undefined);
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      start();
    } else {
      audio.addEventListener('canplay', start, { once: true });
    }
  }

  pause(): void {
    this.audio.pause();
    this.cb.onState('paused');
  }

  resume(): void {
    void this.audio.play().catch(() => undefined);
    this.cb.onState('playing');
  }

  stop(): void {
    this.gen += 1;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.chunks = [];
    this.blobs.clear();
    this.cb.onProgress(null);
    this.cb.onState('idle');
  }

  cycleRate(): SpeechRate {
    const next = nextSpeechRate(this.rate);
    this.rate = next;
    this.audio.playbackRate = next;
    return next;
  }

  dispose(): void {
    this.gen += 1;
    this.audio.pause();
    this.blobs.clear();
    if (this.url !== null) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }
}
