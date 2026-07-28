'use client';

import { useEffect, useMemo, useState } from 'react';
import { SPEECH_VOICE_STORAGE_KEY } from '@/lib/ttsConstants';
import { rankGermanVoices, selectGermanVoice } from '@/lib/selectGermanVoice';
import { readLocal, writeLocal } from '@/lib/localStorageState';

export interface SpeechVoices {
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  setVoiceURI: (uri: string) => void;
  voice: SpeechSynthesisVoice | undefined;
}

// Loads the available German voices (async via `voiceschanged`), tracks the
// user's chosen voice (persisted in localStorage), and resolves the voice to
// actually speak with — the saved choice, else the most natural-sounding one.
export function useSpeechVoices(supported: boolean): SpeechVoices {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(() => readLocal(SPEECH_VOICE_STORAGE_KEY));

  useEffect(() => {
    if (!supported) {
      return;
    }

    const synth = window.speechSynthesis;
    const load = () => {
      setVoices(rankGermanVoices(synth.getVoices()));
    };
    load();
    synth.addEventListener('voiceschanged', load);
    return () => {
      synth.removeEventListener('voiceschanged', load);
    };
  }, [supported]);

  useEffect(() => {
    if (voiceURI !== null) {
      writeLocal(SPEECH_VOICE_STORAGE_KEY, voiceURI);
    }
  }, [voiceURI]);

  // Memoized so a title keystroke (which re-renders ReadAloudControls) doesn't
  // re-run the ranking; only recomputes when voices or the choice change.
  const voice = useMemo(() => selectGermanVoice(voices, voiceURI), [voices, voiceURI]);

  return { voices, voiceURI, setVoiceURI, voice };
}
