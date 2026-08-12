'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  NEURAL_VOICES,
  READ_ALOUD_ERROR_NOTICE,
  READ_ALOUD_FALLBACK_NOTICE,
  READ_ALOUD_START_LABEL,
  TTS_ENGINE_STORAGE_KEY,
  type NeuralVoiceId,
} from '@/lib/ttsConstants';
import type { TtsEngine } from '@/lib/ttsTypes';
import { markdownToPlainText } from '@/lib/markdownToPlainText';
import { readStoredOneOf, writeLocal } from '@/lib/localStorageState';
import { useSpeech } from '@/hooks/useSpeech';
import { useNeuralSpeech } from '@/hooks/useNeuralSpeech';
import { ReadAloudPanel } from './ReadAloudPanel';

const readStoredEngine = (): TtsEngine => readStoredOneOf(TTS_ENGINE_STORAGE_KEY, ['system', 'neural'] as const, 'neural');

interface ReadAloudControlsProps {
  getContent: () => string;
  title: string;
}

export function ReadAloudControls({ getContent, title }: ReadAloudControlsProps) {
  const system = useSpeech();
  const neural = useNeuralSpeech();
  const [open, setOpen] = useState(false);
  const [engine, setEngine] = useState<TtsEngine>(readStoredEngine);
  const [notice, setNotice] = useState<string | null>(null);

  if (!system.supported && !neural.supported) {
    return null;
  }

  const useNeural = engine === 'neural' && neural.supported;
  const active = useNeural ? neural : system;

  const handlePlay = () => {
    setNotice(null);
    const text = markdownToPlainText(getContent(), title);
    if (useNeural) {
      neural.play(text, (kind) => {
        if (kind === 'load' && system.supported) {
          // Model/WASM couldn't load (offline, CDN) → read with the system voice
          // instead of silently doing nothing.
          setEngine('system'); // in-memory only — next session retries neural
          system.setRate(neural.rate); // carry the chosen speed over
          system.play(text);
          setNotice(READ_ALOUD_FALLBACK_NOTICE);
        } else {
          // A later chunk failed mid-note (already stopped) — or no system
          // fallback is available: just tell the user, don't restart from 0.
          setNotice(READ_ALOUD_ERROR_NOTICE);
        }
      });
      return;
    }

    active.play(text);
  };

  const handleEngineChange = (next: TtsEngine) => {
    setNotice(null);
    system.stop();
    neural.stop();
    setEngine(next);
    writeLocal(TTS_ENGINE_STORAGE_KEY, next);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setNotice(null);
    }
  };

  const voiceOptions = useNeural
    ? NEURAL_VOICES.map((v) => ({ value: v.id, label: v.label }))
    : system.voices.map((v) => ({ value: v.voiceURI, label: v.name }));
  const voiceValue = useNeural ? neural.voiceId : (system.voiceURI ?? system.voices[0]?.voiceURI);
  const handleVoiceChange = (v: string) => {
    if (useNeural) {
      neural.setVoiceId(v as NeuralVoiceId);
    } else {
      system.setVoiceURI(v);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={READ_ALOUD_START_LABEL}
          title={READ_ALOUD_START_LABEL}
          className={cn({ 'bg-accent': open || active.state !== 'idle' })}
        >
          <Volume2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={-3} className="w-64">
        <PopoverArrow className="-translate-y-1/2" />
        <ReadAloudPanel
          state={active.state}
          rate={active.rate}
          progress={useNeural ? neural.progress : null}
          notice={notice}
          engine={engine}
          neuralSupported={neural.supported}
          onEngineChange={handleEngineChange}
          onPlay={handlePlay}
          onPause={active.pause}
          onResume={active.resume}
          onStop={active.stop}
          onCycleRate={active.cycleRate}
          voiceOptions={voiceOptions}
          voiceValue={voiceValue}
          onVoiceChange={handleVoiceChange}
        />
      </PopoverContent>
    </Popover>
  );
}
