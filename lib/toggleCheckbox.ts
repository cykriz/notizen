const CHECKBOX_LINE_RE = /^(\s*[-*+]\s+)\[[ xX]\]/;

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
 * Toggles all checkboxes in the same "block" (consecutive non-blank lines)
 * as the given offset. The clicked checkbox determines the direction:
 * if it's unchecked, all become checked — and vice versa.
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

  const replacement = shouldCheck ? '[x]' : '[ ]';
  for (let i = blockStart; i <= blockEnd; i++) {
    lines[i] = lines[i].replace(CHECKBOX_LINE_RE, `$1${replacement}`);
  }

  return lines.join('\n');
}
