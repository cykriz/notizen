import type { NeuralVoiceId } from '@/lib/ttsConstants';

// Main-thread bridge to the neural TTS Web Worker. Keeps synthesis off the UI
// thread; resolves each request by id. Blob bytes are transferred, not copied.

type ProgressCb = (p: { total: number; loaded: number }) => void;

interface Pending {
  resolve: (blob: Blob) => void;
  reject: (err: unknown) => void;
  onProgress?: ProgressCb;
}

interface WorkerMsg {
  id: number;
  type: 'progress' | 'done' | 'error';
  total?: number;
  loaded?: number;
  buf?: ArrayBuffer;
  message?: string;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker !== null) {
    return worker;
  }

  worker = new Worker(new URL('./neuralTts.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<WorkerMsg>) => {
    const msg = event.data;
    const entry = pending.get(msg.id);
    if (entry === undefined) {
      return;
    }

    if (msg.type === 'progress') {
      entry.onProgress?.({ total: msg.total ?? 0, loaded: msg.loaded ?? 0 });
      return;
    }

    pending.delete(msg.id);
    if (msg.type === 'done' && msg.buf !== undefined) {
      entry.resolve(new Blob([msg.buf], { type: 'audio/wav' }));
    } else {
      entry.reject(new Error(msg.message ?? 'Neural TTS failed'));
    }
  });

  // If the worker script itself fails to load/execute (e.g. offline before it's
  // cached), no 'message' ever arrives — reject all pending so callers can fall
  // back to the system voice instead of hanging in "loading". Drop the worker so
  // the next play() attempt recreates it.
  const failAll = (message: string) => {
    worker = null;
    for (const entry of pending.values()) {
      entry.reject(new Error(message));
    }
    pending.clear();
  };
  worker.addEventListener('error', (event) => {
    failAll(event.message !== '' ? event.message : 'Neural TTS worker failed to load');
  });
  worker.addEventListener('messageerror', () => {
    failAll('Neural TTS worker message error');
  });
  return worker;
}

/** Synthesize one chunk in the worker. Resolves with the WAV blob. */
export function synthChunk(text: string, voiceId: NeuralVoiceId, onProgress?: ProgressCb): Promise<Blob> {
  const id = (seq += 1);
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, text, voiceId });
  });
}
