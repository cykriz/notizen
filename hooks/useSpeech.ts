'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SPEECH_RATE, SPEECH_LANG, nextSpeechRate, type SpeechRate } from '@/lib/ttsConstants';
import type { SpeechControls, SpeechState } from '@/lib/types';
import { splitIntoSpeechChunks } from '@/lib/markdownToPlainText';
import { useClientMounted } from './useClientMounted';
import { useSpeechVoices } from './useSpeechVoices';

// Chrome silently auto-pauses synthesis after ~15s; toggling pause/resume on an
// interval keeps a long utterance alive. Gated to the 'playing' state.
const KEEP_ALIVE_MS = 10_000;

export function useSpeech(): SpeechControls {
  // Hydration-safe: false on server + first client render, then the real value.
  const supported = useClientMounted() && typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [state, setState] = useState<SpeechState>('idle');
  const [rate, setRate] = useState<SpeechRate>(DEFAULT_SPEECH_RATE);
  const { voices, voiceURI, setVoiceURI, voice } = useSpeechVoices(supported);

  const voiceRef = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const utteranceIdRef = useRef(0);
  const rateRef = useRef<SpeechRate>(rate);
  // Set when the rate is cycled while paused, so resume() restarts at the new rate.
  const rateChangedWhilePausedRef = useRef(false);
  const speakChunkRef = useRef<(fromChar: number) => void>(() => undefined);

  // Keep the resolved voice in a ref so speakChunk always reads the current one.
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // Keep-alive against Chrome's ~15s cutoff; only while actively playing.
  useEffect(() => {
    if (state !== 'playing') {
      return;
    }

    const synth = window.speechSynthesis;
    const id = setInterval(() => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, KEEP_ALIVE_MS);
    return () => {
      clearInterval(id);
    };
  }, [state]);

  // Cancel any speech when the hook unmounts (note switch / route away / tab close).
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakChunk = useCallback((fromChar: number) => {
    const synth = window.speechSynthesis;
    const chunks = chunksRef.current;
    if (chunkIndexRef.current >= chunks.length) {
      setState('idle');
      return;
    }

    // Bump id BEFORE cancel so a stale onend/onerror from the cancelled utterance bails out.
    const id = (utteranceIdRef.current += 1);
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndexRef.current].slice(fromChar));
    utterance.lang = SPEECH_LANG;
    if (voiceRef.current !== undefined) {
      utterance.voice = voiceRef.current;
    }

    utterance.rate = rateRef.current;
    charIndexRef.current = fromChar;

    utterance.onboundary = (event) => {
      charIndexRef.current = fromChar + event.charIndex;
    };
    utterance.onend = () => {
      if (id !== utteranceIdRef.current) {
        return;
      } // stale (from cancel/restart)

      chunkIndexRef.current += 1;
      if (chunkIndexRef.current < chunksRef.current.length) {
        charIndexRef.current = 0;
        speakChunkRef.current(0);
      } else {
        setState('idle');
      }
    };
    utterance.onerror = () => {
      if (id !== utteranceIdRef.current) {
        return;
      }

      setState('idle');
    };

    synth.speak(utterance);
  }, []);

  // Kept in a ref so onend can recurse into the next chunk without a self-dependency.
  useEffect(() => {
    speakChunkRef.current = speakChunk;
  }, [speakChunk]);

  const play = useCallback(
    (text: string) => {
      if (!supported) {
        return;
      }

      const chunks = splitIntoSpeechChunks(text);
      if (chunks.length === 0) {
        return;
      }

      chunksRef.current = chunks;
      chunkIndexRef.current = 0;
      charIndexRef.current = 0;
      rateChangedWhilePausedRef.current = false;
      setState('playing');
      speakChunk(0);
    },
    [supported, speakChunk],
  );

  const pause = useCallback(() => {
    if (!supported) {
      return;
    }

    window.speechSynthesis.pause();
    setState('paused');
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) {
      return;
    }

    // resume() first: it clears the global paused flag so the restart's cancel()
    // + speak() actually plays (Chrome leaves synthesis paused otherwise).
    window.speechSynthesis.resume();
    setState('playing');
    if (rateChangedWhilePausedRef.current) {
      rateChangedWhilePausedRef.current = false;
      speakChunk(charIndexRef.current);
    }
  }, [supported, speakChunk]);

  const stop = useCallback(() => {
    if (!supported) {
      return;
    }

    utteranceIdRef.current += 1; // invalidate the pending onend
    window.speechSynthesis.cancel();
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    charIndexRef.current = 0;
    rateChangedWhilePausedRef.current = false;
    setState('idle');
  }, [supported]);

  const applyRate = useCallback((next: SpeechRate) => {
    rateRef.current = next;
    setRate(next);
  }, []);

  const cycleRate = useCallback(
    () => {
      applyRate(nextSpeechRate(rateRef.current));
      if (state === 'playing') {
        // Apply immediately by restarting the current chunk from the last boundary.
        speakChunk(charIndexRef.current);
      } else if (state === 'paused') {
        // Can't change rate on the (paused) live utterance; apply on resume.
        rateChangedWhilePausedRef.current = true;
      }
    },
    [state, applyRate, speakChunk],
  );

  return { supported, state, rate, voices, voiceURI, setVoiceURI, setRate: applyRate, play, pause, resume, stop, cycleRate };
}
