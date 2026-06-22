import { describe, expect, test } from 'bun:test';
import { toggleBlockCheckboxes, toggleCheckboxAtOffset, transformLineToCheckbox } from './toggleCheckbox';

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

  test('toggles only same-indent siblings, not parent or other levels', () => {
    const src = '- [ ] A\n  - [ ] A1\n  - [ ] A2\n- [ ] B';
    // Click A1 (bracket at offset 12) → only A1 + A2 (indent "  ") toggle
    expect(toggleBlockCheckboxes(src, 12)).toBe('- [ ] A\n  - [x] A1\n  - [x] A2\n- [ ] B');
  });

  test('clicking a top-level item toggles only top-level items, not children', () => {
    const src = '- [ ] A\n  - [ ] A1\n  - [ ] A2\n- [ ] B';
    // Click A (bracket at offset 2) → only A + B (indent "") toggle
    expect(toggleBlockCheckboxes(src, 2)).toBe('- [x] A\n  - [ ] A1\n  - [ ] A2\n- [x] B');
  });

  test('direction is driven by the clicked item among same-level siblings', () => {
    const src = '- [ ] A\n  - [x] A1\n  - [ ] A2';
    // Click A1 (checked, offset 12) → unchecks same-level siblings
    expect(toggleBlockCheckboxes(src, 12)).toBe('- [ ] A\n  - [ ] A1\n  - [ ] A2');
  });

  test('same indent across different parents in one block toggles together', () => {
    const src = '- [ ] A\n  - [ ] A1\n  - [ ] A2\n- [ ] B\n  - [ ] B1';
    // No blank line → single block. Click A1 (offset 12) → all indent "  " toggle, incl. B1
    expect(toggleBlockCheckboxes(src, 12)).toBe(
      '- [ ] A\n  - [x] A1\n  - [x] A2\n- [ ] B\n  - [x] B1',
    );
  });
});

describe('transformLineToCheckbox', () => {
  test('unchecked → checked', () => {
    expect(transformLineToCheckbox('- [ ] task')).toEqual({
      line: '- [x] task',
      cursorDelta: 0,
    });
  });

  test('checked → unchecked', () => {
    expect(transformLineToCheckbox('- [x] task')).toEqual({
      line: '- [ ] task',
      cursorDelta: 0,
    });
  });

  test('uppercase [X] → unchecked', () => {
    expect(transformLineToCheckbox('- [X] task')).toEqual({
      line: '- [ ] task',
      cursorDelta: 0,
    });
  });

  test('plain list item → checkbox list item', () => {
    expect(transformLineToCheckbox('- buy milk')).toEqual({
      line: '- [ ] buy milk',
      cursorDelta: 4,
    });
  });

  test('asterisk list item → checkbox list item', () => {
    expect(transformLineToCheckbox('* buy milk')).toEqual({
      line: '* [ ] buy milk',
      cursorDelta: 4,
    });
  });

  test('plain text → checkbox list item', () => {
    expect(transformLineToCheckbox('buy milk')).toEqual({
      line: '- [ ] buy milk',
      cursorDelta: 6,
    });
  });

  test('indented plain text preserves indent', () => {
    expect(transformLineToCheckbox('  buy milk')).toEqual({
      line: '  - [ ] buy milk',
      cursorDelta: 6,
    });
  });

  test('empty line → checkbox list item', () => {
    expect(transformLineToCheckbox('')).toEqual({
      line: '- [ ] ',
      cursorDelta: 6,
    });
  });
});
