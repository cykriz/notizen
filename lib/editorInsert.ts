export function insertAtCursor(value: string, pos: number, insertion: string): string {
  const before = value.slice(0, pos);
  const after = value.slice(pos);
  const sep = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  return `${before}${sep}${insertion}\n${after}`;
}
