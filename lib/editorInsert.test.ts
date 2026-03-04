import { insertAtCursor } from "./editorInsert";

/* eslint-disable no-console */
function runTests() {
  const sep = '─'.repeat(50);
  console.log(`\n${sep}\n  editorInsert Tests\n${sep}\n`);

  const r1 = insertAtCursor('hello', 5, 'world');
  if (r1 !== 'hello\nworld\n') {
    throw new Error(`insertAtCursor end-of-content failed: ${JSON.stringify(r1)}`);
  }

  console.log('✓ insertAtCursor — appends with newline separator');

  const r2 = insertAtCursor('line1\n', 6, 'line2');
  if (r2 !== 'line1\nline2\n') {
    throw new Error(`insertAtCursor after-newline failed: ${JSON.stringify(r2)}`);
  }

  console.log('✓ insertAtCursor — no double newline when previous ends with \\n');

  const r3 = insertAtCursor('', 0, 'first');
  if (r3 !== 'first\n') {
    throw new Error(`insertAtCursor empty failed: ${JSON.stringify(r3)}`);
  }

  console.log('✓ insertAtCursor — works on empty string');

  const r4 = insertAtCursor('aabb', 2, 'XX');
  if (r4 !== 'aa\nXX\nbb') {
    throw new Error(`insertAtCursor mid failed: ${JSON.stringify(r4)}`);
  }

  console.log('✓ insertAtCursor — inserts in the middle');

  console.log(`\n${sep}\n  ALL TESTS PASSED ✓\n${sep}\n`);
}

runTests();
