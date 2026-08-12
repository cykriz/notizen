'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_NEURAL_VOICE,
  DEFAULT_SPEECH_RATE,
  NEURAL_VOICE_STORAGE_KEY,
  NEURAL_VOICES,
  type NeuralVoiceId,
  type SpeechRate,
} from '@/lib/ttsConstants';
import type { NeuralSpeechControls, ReadAloudErrorKind, ReadAloudState } from '@/lib/ttsTypes';
import { readStoredOneOf, writeLocal } from '@/lib/localStorageState';
import { useClientMounted } from './useClientMounted';
import { NeuralPlayer } from '@/lib/neuralPlayer';

// Neural TTS needs WebAssembly + OPFS (to run/cache the model).
const isNeuralSupported = () =>
  typeof WebAssembly !== 'undefined' &&
  typeof navigator.storage !== 'undefined' &&
  typeof navigator.storage.getDirectory === 'function';

const NEURAL_VOICE_IDS = NEURAL_VOICES.map((v) => v.id);

export function useNeuralSpeech(): NeuralSpeechControls {
  // Hydration-safe: false on server + first client render, then the real value.
  const supported = useClientMounted() && isNeuralSupported();
  const [state, setState] = useState<ReadAloudState>('idle');
  const [rate, setRate] = useState<SpeechRate>(DEFAULT_SPEECH_RATE);
  const [progress, setProgress] = useState<number | null>(null);
  const [voiceId, setVoiceId] = useState<NeuralVoiceId>(() =>
    readStoredOneOf(NEURAL_VOICE_STORAGE_KEY, NEURAL_VOICE_IDS, DEFAULT_NEURAL_VOICE),
  );
  const playerRef = useRef<NeuralPlayer | null>(null);

  useEffect(() => {
    if (!supported) {
      return;
    }

    const player = new NeuralPlayer({ onState: setState, onProgress: setProgress });
    player.voiceId = voiceId;
    player.rate = rate;
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // Created once when support flips true; voice/rate are kept in sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => {
    if (playerRef.current !== null) {
      playerRef.current.voiceId = voiceId;
    }

    writeLocal(NEURAL_VOICE_STORAGE_KEY, voiceId);
  }, [voiceId]);

  const play = useCallback((text: string, onError?: (kind: ReadAloudErrorKind) => void) => {
    playerRef.current?.play(text, onError);
  }, []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const resume = useCallback(() => playerRef.current?.resume(), []);
  const stop = useCallback(() => playerRef.current?.stop(), []);
  const cycleRate = useCallback(() => {
    const next = playerRef.current?.cycleRate();
    if (next !== undefined) {
      setRate(next);
    }
  }, []);

  return { supported, state, rate, progress, voiceId, setVoiceId, play, pause, resume, stop, cycleRate };
}
