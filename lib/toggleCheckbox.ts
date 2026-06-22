const LIST_PREFIX_RE = /^(\s*[-*+]\s+)/;
const CHECKBOX_LINE_RE = /^(\s*[-*+]\s+)\[[ xX]\]/;
const UNCHECKED_LINE_RE = /^(\s*[-*+]\s+)\[ \]/;
const CHECKED_LINE_RE = /^(\s*[-*+]\s+)\[[xX]\]/;
const INDENT_RE = /^(\s*)/;

export interface CheckboxLineTransform {
  line: string;
  cursorDelta: number;
}

/**
 * Converts a single editor line into a markdown task checkbox, or toggles
 * the checked state if it already is one. Returns the new line text plus
 * how many characters the cursor should shift right.
 */
export function transformLineToCheckbox(lineText: string): CheckboxLineTransform {
  const uncheckedMatch = UNCHECKED_LINE_RE.exec(lineText);
  if (uncheckedMatch) {
    return {
      line: `${uncheckedMatch[1]}[x]${lineText.slice(uncheckedMatch[0].length)}`,
      cursorDelta: 0,
    };
  }

  const checkedMatch = CHECKED_LINE_RE.exec(lineText);
  if (checkedMatch) {
    return {
      line: `${checkedMatch[1]}[ ]${lineText.slice(checkedMatch[0].length)}`,
      cursorDelta: 0,
    };
  }

  const listMatch = LIST_PREFIX_RE.exec(lineText);
  if (listMatch) {
    return {
      line: `${listMatch[1]}[ ] ${lineText.slice(listMatch[0].length)}`,
      cursorDelta: 4,
    };
  }

  const indent = INDENT_RE.exec(lineText)?.[1] ?? '';
  return {
    line: `${indent}- [ ] ${lineText.slice(indent.length)}`,
    cursorDelta: 6,
  };
}

/**
 * Toggles a markdown checkbox at a specific character offset.
 *
 * @param source  Full markdown string
 * @param bracketOffset  Character index of the opening `[` in `[ ]` or `[x]`
 * @returns Updated markdown string with the checkbox toggled
 */
export function toggleCheckboxAtOffset(source: string, bracketOffset: number): string {
  if (bracketOffset < 0 || bracketOffset + 3 > source.length) {
    return source;
  }

  const slice = source.slice(bracketOffset, bracketOffset + 3);

  if (slice === '[ ]') {
    return `${source.slice(0, bracketOffset)}[x]${source.slice(bracketOffset + 3)}`;
  }

  if (slice === '[x]' || slice === '[X]') {
    return `${source.slice(0, bracketOffset)}[ ]${source.slice(bracketOffset + 3)}`;
  }

  return source;
}

/**
 * Toggles all checkboxes on the same indentation level within the same
 * "block" (consecutive non-blank lines) as the given offset. The clicked
 * checkbox determines the direction: if it's unchecked, all become checked
 * — and vice versa. Checkboxes at a different indentation (parents, nested
 * children) are left untouched.
 */
export function toggleBlockCheckboxes(source: string, bracketOffset: number): string {
  if (bracketOffset < 0 || bracketOffset + 3 > source.length) {
    return source;
  }

  const shouldCheck = source[bracketOffset + 1] === ' ';

  const lines = source.split('\n');
  let charCount = 0;
  let clickedLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= bracketOffset) {
      clickedLine = i;
      break;
    }

    charCount += lines[i].length + 1;
  }

  if (clickedLine === -1) {
    return source;
  }

  let blockStart = clickedLine;
  while (blockStart > 0 && lines[blockStart - 1].trim() !== '') {
    blockStart--;
  }

  let blockEnd = clickedLine;
  while (blockEnd < lines.length - 1 && lines[blockEnd + 1].trim() !== '') {
    blockEnd++;
  }

  const clickedIndent = INDENT_RE.exec(lines[clickedLine])?.[1] ?? '';

  const replacement = shouldCheck ? '[x]' : '[ ]';
  for (let i = blockStart; i <= blockEnd; i++) {
    const indent = INDENT_RE.exec(lines[i])?.[1] ?? '';
    if (indent === clickedIndent) {
      lines[i] = lines[i].replace(CHECKBOX_LINE_RE, `$1${replacement}`);
    }
  }

  return lines.join('\n');
}
