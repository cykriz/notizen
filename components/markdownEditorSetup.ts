import { EditorView } from '@codemirror/view';
import type { BasicSetupOptions } from '@uiw/react-codemirror';
import type { Extension } from '@codemirror/state';

export const editorBasicSetup: BasicSetupOptions = {
  lineNumbers: false,
  foldGutter: false,
  dropCursor: false,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  rectangularSelection: false,
  crosshairCursor: false,
  closeBracketsKeymap: false,
  foldKeymap: false,
  completionKeymap: false,
  lintKeymap: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  searchKeymap: true,
  historyKeymap: true,
  defaultKeymap: true,
};

// Non-reactive extensions shared across all editor instances.
// Styling is handled entirely by app/custom-components.css — no EditorView.theme() needed.
export const staticExtensions: Extension[] = [
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({
    spellcheck: 'true',
    autocorrect: 'on',
    autocapitalize: 'sentences',
  }),
];
