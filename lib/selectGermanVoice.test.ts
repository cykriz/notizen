import { describe, expect, test } from 'bun:test';
import { rankGermanVoices, selectGermanVoice } from './selectGermanVoice';

const voice = (lang: string, name: string = lang): SpeechSynthesisVoice =>
  ({ lang, name, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe('selectGermanVoice', () => {
  test('prefers a natural voice (Premium/Enhanced) over the robotic default', () => {
    const chosen = selectGermanVoice([voice('de-DE', 'Anna'), voice('de-DE', 'Anna (Premium)')]);
    expect(chosen?.name).toBe('Anna (Premium)');
  });

  test('ranks Siri and Google above a plain voice', () => {
    const ranked = rankGermanVoices([voice('de-DE', 'Anna'), voice('de-DE', 'Google Deutsch'), voice('de-DE', 'Helena (Siri)')]);
    expect(ranked.map((v) => v.name)).toEqual(['Helena (Siri)', 'Google Deutsch', 'Anna']);
  });

  test('prefers an exact de-DE match over other German locales', () => {
    const chosen = selectGermanVoice([voice('en-US'), voice('de-AT'), voice('de-DE')]);
    expect(chosen?.lang).toBe('de-DE');
  });

  test('falls back to any de-* when no de-DE exists', () => {
    const chosen = selectGermanVoice([voice('en-US'), voice('de-AT')]);
    expect(chosen?.lang).toBe('de-AT');
  });

  test('matches the de prefix case-insensitively', () => {
    const chosen = selectGermanVoice([voice('DE-CH')]);
    expect(chosen?.lang).toBe('DE-CH');
  });

  test('honours a preferred voiceURI when still available', () => {
    const chosen = selectGermanVoice([voice('de-DE', 'Anna'), voice('de-DE', 'Anna (Premium)')], 'Anna');
    expect(chosen?.name).toBe('Anna');
  });

  test('falls back to the best voice when the preferred one is gone', () => {
    const chosen = selectGermanVoice([voice('de-DE', 'Anna'), voice('de-DE', 'Anna (Premium)')], 'Weg');
    expect(chosen?.name).toBe('Anna (Premium)');
  });

  test('returns undefined when no German voice is available', () => {
    expect(selectGermanVoice([voice('en-US'), voice('fr-FR')])).toBeUndefined();
  });

  test('returns undefined for an empty voice list', () => {
    expect(selectGermanVoice([])).toBeUndefined();
  });
});
