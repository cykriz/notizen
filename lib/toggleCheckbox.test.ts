import { describe, expect, test } from 'bun:test';
import { toggleBlockCheckboxes, toggleCheckboxAtOffset } from './toggleCheckbox';

describe('toggleCheckboxAtOffset', () => {
  test('[ ] → [x]', () => {
    expect(toggleCheckboxAtOffset('- [ ] buy milk', 2)).toBe('- [x] buy milk');
  });

  test('[x] → [ ]', () => {
    expect(toggleCheckboxAtOffset('- [x] buy milk', 2)).toBe('- [ ] buy milk');
  });

  test('[X] → [ ]', () => {
    expect(toggleCheckboxAtOffset('- [X] buy milk', 2)).toBe('- [ ] buy milk');
  });

  test('no-match returns source unchanged', () => {
    const src = 'just some text';
    expect(toggleCheckboxAtOffset(src, 0)).toBe(src);
  });

  test('toggle second checkbox in multi-line', () => {
    expect(toggleCheckboxAtOffset('- [ ] first\n- [x] second', 14)).toBe(
      '- [ ] first\n- [ ] second',
    );
  });

  test('offset past content returns source unchanged', () => {
    const src = '- [ ] task';
    expect(toggleCheckboxAtOffset(src, src.length)).toBe(src);
  });

  test('negative offset returns source unchanged', () => {
    const src = '- [ ] task';
    expect(toggleCheckboxAtOffset(src, -1)).toBe(src);
  });
});

describe('toggleBlockCheckboxes', () => {
  test('checks all unchecked items in a block', () => {
    const src = '- [ ] a\n- [ ] b\n- [ ] c';
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [x] a\n- [x] b\n- [x] c');
  });

  test('unchecks all checked items in a block', () => {
    const src = '- [x] a\n- [x] b\n- [x] c';
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [ ] a\n- [ ] b\n- [ ] c');
  });

  test('stops at blank lines', () => {
    const src = '- [ ] a\n- [ ] b\n\n- [ ] c\n- [ ] d';
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [x] a\n- [x] b\n\n- [ ] c\n- [ ] d');
  });

  test('leaves non-checkbox lines untouched', () => {
    const src = '- [ ] a\nsome text\n- [ ] b';
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [x] a\nsome text\n- [x] b');
  });

  test('single-item block', () => {
    const src = '- [ ] only';
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [x] only');
  });

  test('offset past content returns source unchanged', () => {
    const src = '- [ ] a';
    expect(toggleBlockCheckboxes(src, 999)).toBe(src);
  });

  test('handles mixed checked states — clicked item drives direction', () => {
    const src = '- [x] done\n- [ ] todo\n- [x] also done';
    // Clicked item is checked → unchecks the entire block
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [ ] done\n- [ ] todo\n- [ ] also done');
  });

  test('handles [X] uppercase checkboxes', () => {
    const src = '- [X] a\n- [X] b';
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [ ] a\n- [ ] b');
  });

  test('negative offset returns source unchanged', () => {
    const src = '- [ ] a';
    expect(toggleBlockCheckboxes(src, -1)).toBe(src);
  });
});
