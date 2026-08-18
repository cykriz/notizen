import { describe, expect, test } from 'bun:test';

import { comboOf, SHORTCUT } from './globalShortcuts';

/** Structurally what comboOf reads off a KeyboardEvent; unset modifiers default to false. */
function press(over: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
}) {
  return { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, ...over };
}

describe('comboOf', () => {
  test('maps a Mod combo to the SHORTCUT value, on either modifier', () => {
    expect(comboOf(press({ key: 'p', metaKey: true }))).toBe(SHORTCUT.PALETTE);
    expect(comboOf(press({ key: 'p', ctrlKey: true }))).toBe(SHORTCUT.PALETTE);
    expect(comboOf(press({ key: '1', ctrlKey: true }))).toBe(SHORTCUT.VIEW_NOTES);
  });

  // The bug this normalisation exists for: with Shift held, KeyboardEvent.key is the upper-case
  // letter, so the old `e.key === 'o'` comparison matched neither the outline branch nor the
  // preview one and Mod+Shift+O did nothing at all.
  test('separates Mod+Shift+O from Mod+O although the key arrives upper-cased', () => {
    expect(comboOf(press({ key: 'O', ctrlKey: true, shiftKey: true }))).toBe(SHORTCUT.OUTLINE);
    expect(comboOf(press({ key: 'o', metaKey: true }))).toBe(SHORTCUT.PREVIEW);
  });

  test('claims nothing without a modifier', () => {
    expect(comboOf(press({ key: 'p' }))).toBeNull();
    expect(comboOf(press({ key: 'p', shiftKey: true }))).toBeNull();
  });

  // AltGr reports ctrl+alt on Windows/Linux. Claiming those in the capture phase would prevent the
  // character from ever reaching the input.
  test('leaves AltGr and IME composition alone', () => {
    expect(comboOf(press({ key: 'p', ctrlKey: true, altKey: true }))).toBeNull();
    expect(comboOf(press({ key: 'p', ctrlKey: true, isComposing: true }))).toBeNull();
  });
});
