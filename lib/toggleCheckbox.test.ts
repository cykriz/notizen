import { describe, expect, test } from 'bun:test';
import { toggleCheckboxAtOffset } from './toggleCheckbox';

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
