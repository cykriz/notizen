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
  // Einrücktiefe für jeden Einrück-Pfad auf einmal: Tab/Shift+Tab (indentWithTab),
  // Mod+]/Mod+[ aus defaultKeymap, der Toolbar-Button „Einrücken" und das Einrasten von
  // Backspace im führenden Whitespace lesen alle dasselbe indentUnit-Facet.
  // Trotz des Namens setzt basicSetup daraus indentUnit.of('    ') — nicht EditorState.tabSize.
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
