import { SPEECH_LANG } from './ttsConstants';

const LANG_PREFIX = `${SPEECH_LANG.split('-')[0]}-`; // 'de-'

// Heuristic quality hints found in voice names. Natural / neural voices across
// platforms: macOS (Premium / Enhanced / Siri), Chrome (Google network voices),
// Windows & Edge (Microsoft "… Natural"). Higher score = more natural-sounding.
const QUALITY_HINTS: { re: RegExp; score: number }[] = [
  { re: /premium/i, score: 5 },
  { re: /enhanced/i, score: 5 },
  { re: /neural/i, score: 5 },
  { re: /natural/i, score: 5 },
  { re: /siri/i, score: 4 },
  { re: /google/i, score: 3 },
];

function isGerman(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith(LANG_PREFIX);
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0;
  for (const hint of QUALITY_HINTS) {
    if (hint.re.test(voice.name)) {
      score += hint.score;
    }
  }
  // Prefer exact de-DE over other German locales (de-AT, de-CH) as a tie-breaker.
  if (voice.lang === SPEECH_LANG) {
    score += 1;
  }

  return score;
}

/** German voices, most natural-sounding first (stable within equal scores). */
export function rankGermanVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .map((voice, index) => ({ voice, index }))
    .filter((entry) => isGerman(entry.voice))
    .sort((a, b) => {
      const byScore = scoreVoice(b.voice) - scoreVoice(a.voice);
      return byScore !== 0 ? byScore : a.index - b.index;
    })
    .map((entry) => entry.voice);
}

/**
 * Picks the German voice to speak with: the user's saved choice if it is still
 * available, otherwise the highest-ranked (most natural) German voice. Returns
 * undefined when no German voice exists — the utterance's `lang` still forces
 * German pronunciation via the browser default.
 */
export function selectGermanVoice(
  voices: SpeechSynthesisVoice[],
  preferredUri?: string | null,
): SpeechSynthesisVoice | undefined {
  const german = rankGermanVoices(voices);
  if (preferredUri !== undefined && preferredUri !== null) {
    const chosen = german.find((voice) => voice.voiceURI === preferredUri);
    if (chosen !== undefined) {
      return chosen;
    }
  }

  return german[0];
}
