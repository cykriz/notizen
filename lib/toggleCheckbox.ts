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
