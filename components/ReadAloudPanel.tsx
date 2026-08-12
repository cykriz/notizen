'use client';

import type { ReactNode } from 'react';
import { Loader2, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LabeledSelect, type SelectOption } from '@/components/LabeledSelect';
import {
  READ_ALOUD_ENGINE_LABEL,
  READ_ALOUD_ENGINE_NEURAL,
  READ_ALOUD_ENGINE_SYSTEM,
  READ_ALOUD_LOADING_LABEL,
  READ_ALOUD_PAUSE_LABEL,
  READ_ALOUD_RESUME_LABEL,
  READ_ALOUD_SPEED_LABEL,
  READ_ALOUD_START_LABEL,
  READ_ALOUD_STOP_LABEL,
  READ_ALOUD_VOICE_LABEL,
  type SpeechRate,
} from '@/lib/ttsConstants';
import type { ReadAloudState, TtsEngine } from '@/lib/ttsTypes';

const rateFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const formatRate = (rate: SpeechRate) => `${rateFormatter.format(rate)}×`;

interface ReadAloudPanelProps {
  state: ReadAloudState;
  rate: SpeechRate;
  progress: number | null;
  notice: string | null;
  engine: TtsEngine;
  neuralSupported: boolean;
  onEngineChange: (engine: TtsEngine) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCycleRate: () => void;
  voiceOptions: SelectOption[];
  voiceValue: string | undefined;
  onVoiceChange: (value: string) => void;
}

export function ReadAloudPanel(props: ReadAloudPanelProps) {
  const { state, rate, progress, notice, engine, neuralSupported, onEngineChange } = props;
  const active = state !== 'idle';
  const loading = state === 'loading';

  let primary: { icon: ReactNode; onClick: () => void; label: string; disabled: boolean };
  if (loading) {
    primary = { icon: <Loader2 className="animate-spin" />, onClick: () => undefined, label: READ_ALOUD_LOADING_LABEL, disabled: true };
  } else if (state === 'playing') {
    primary = { icon: <Pause />, onClick: props.onPause, label: READ_ALOUD_PAUSE_LABEL, disabled: false };
  } else if (state === 'paused') {
    primary = { icon: <Play />, onClick: props.onResume, label: READ_ALOUD_RESUME_LABEL, disabled: false };
  } else {
    primary = { icon: <Play />, onClick: props.onPlay, label: READ_ALOUD_START_LABEL, disabled: false };
  }

  const engineOptions: SelectOption[] = [
    { value: 'system', label: READ_ALOUD_ENGINE_SYSTEM },
    ...(neuralSupported ? [{ value: 'neural', label: READ_ALOUD_ENGINE_NEURAL }] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{READ_ALOUD_START_LABEL}</p>
      <div className="flex items-center gap-1">
        <Button onClick={primary.onClick} disabled={primary.disabled} size="icon-sm" variant="ghost" aria-label={primary.label} title={primary.label}>
          {primary.icon}
        </Button>
        <Button onClick={props.onStop} size="icon-sm" variant="ghost" disabled={!active} aria-label={READ_ALOUD_STOP_LABEL} title={READ_ALOUD_STOP_LABEL}>
          <Square />
        </Button>
        <Button
          onClick={props.onCycleRate}
          size="sm"
          variant="ghost"
          className="tabular-nums font-medium"
          aria-label={`${READ_ALOUD_SPEED_LABEL}: ${formatRate(rate)}`}
          title={READ_ALOUD_SPEED_LABEL}
        >
          {formatRate(rate)}
        </Button>
      </div>

      {loading && progress !== null && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{READ_ALOUD_LOADING_LABEL}</p>
          <Progress value={Math.round(progress * 100)} className="h-1" />
        </div>
      )}

      {notice !== null && <p className="text-xs text-muted-foreground">{notice}</p>}

      {neuralSupported && (
        <LabeledSelect
          label={READ_ALOUD_ENGINE_LABEL}
          value={engine}
          options={engineOptions}
          onChange={(v) => {
            onEngineChange(v as TtsEngine);
          }}
        />
      )}

      {props.voiceOptions.length > 1 && (
        <LabeledSelect
          label={READ_ALOUD_VOICE_LABEL}
          value={props.voiceValue}
          options={props.voiceOptions}
          onChange={props.onVoiceChange}
        />
      )}
    </div>
  );
}
