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
  // Indent depth for every indent path at once: Tab/Shift+Tab (indentWithTab),
  // Mod+]/Mod+[ from defaultKeymap, the toolbar button "Einrücken" and the snapping of
  // Backspace in leading whitespace all read the same indentUnit facet.
  // Despite the name, basicSetup turns this into indentUnit.of('    ') — not EditorState.tabSize.
  tabSize: 4,
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
