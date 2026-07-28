// Dedicated Web Worker: runs the neural TTS engine (vits-web + onnxruntime
// WASM) OFF the main thread, so synthesis (seconds of WASM compute per chunk)
// never freezes the UI. Driven by lib/neuralTtsClient.ts via postMessage.
import * as tts from '@diffusionstudio/vits-web';
import type { NeuralVoiceId } from '@/lib/ttsConstants';

interface SynthRequest {
  id: number;
  text: string;
  voiceId: NeuralVoiceId;
}

// Typed access to the worker global without pulling in the webworker lib (which
// would clash with the project's DOM lib). At runtime this IS the worker scope.
const ctx = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SynthRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

async function synth(
  text: string,
  voiceId: NeuralVoiceId,
  onProgress: (total: number, loaded: number) => void,
): Promise<Blob> {
  try {
    return await tts.predict({ text, voiceId }, (p) => {
      onProgress(p.total, p.loaded);
    });
  } catch {
    // Likely a truncated/corrupt OPFS cache — drop it and re-download once.
    try {
      await tts.remove(voiceId);
    } catch {
      /* ignore */
    }
    return await tts.predict({ text, voiceId }, (p) => {
      onProgress(p.total, p.loaded);
    });
  }
}

ctx.onmessage = (event) => {
  const { id, text, voiceId } = event.data;
  void synth(text, voiceId, (total, loaded) => {
    ctx.postMessage({ id, type: 'progress', total, loaded });
  })
    .then(async (wav) => {
      const buf = await wav.arrayBuffer();
      ctx.postMessage({ id, type: 'done', buf }, [buf]);
    })
    .catch((err: unknown) => {
      ctx.postMessage({ id, type: 'error', message: String(err) });
    });
};
