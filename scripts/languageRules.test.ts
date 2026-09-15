import { describe, expect, test } from 'bun:test';

import { checkCommitMessage, checkMarkdown, checkSource, germanTrigger } from './languageRules';

const src = (body: string) => checkSource('probe.tsx', body);

describe('germanTrigger', () => {
  test('flags an umlaut', () => {
    expect(germanTrigger('the Zähler goes here')).toBe('ä');
  });

  test('flags a stopword without any umlaut', () => {
    expect(germanTrigger('der Wert steht oben')).not.toBeNull();
  });

  test('passes plain English', () => {
    expect(germanTrigger('the counter goes on the same row')).toBeNull();
  });

  test('passes English words that look like German stopwords', () => {
    // 'die' and 'den' are English too, which is why they are not on the list — this exact sentence
    // from lib/clearSwCaches.ts was a false positive once.
    expect(germanTrigger('an await could die with the document')).toBeNull();
    expect(germanTrigger('the den is on the left')).toBeNull();
  });

  test('German inside quotes is a citation of UI copy, not prose', () => {
    expect(germanTrigger('dead-ends on "Papierkorb konnte nicht geprüft werden".')).toBeNull();
    expect(germanTrigger('the toolbar button "Einrücken" and the snapping')).toBeNull();
  });

  test('typographic German quotes count as quotes', () => {
    // „…“, not two ASCII double quotes — the character class used to hold only `"`, so this leaked.
    expect(germanTrigger('the button „Einrücken“ and the snapping')).toBeNull();
  });

  test('two apostrophes do not pair up and swallow the German between them', () => {
    // `'[^'\n]*'` treated `don't … that's` as one quoted span and blanked what sat inside it.
    expect(germanTrigger("don't touch der Zaehler, that's the caller's job")).not.toBeNull();
  });
});

describe('checkSource — comments', () => {
  test('flags a German line comment', () => {
    expect(src('// Die Zeile ist deutsch.\nexport const a = 1;\n')).toHaveLength(1);
  });

  test('passes an English line comment', () => {
    expect(src('// This line is English.\nexport const a = 1;\n')).toHaveLength(0);
  });

  /**
   * The reason this checker exists rather than a grep. A multi-line JSX comment carries no marker on
   * its continuation lines, so `^\s*(//|\*|/\*|\{/\*)` cannot see line 2 — and the German sits there.
   */
  test('flags German on the continuation line of a multi-line JSX comment', () => {
    const hits = src(
      'export function A() {\n' +
        '  return (\n' +
        '    <div>\n' +
        '      {/* `block`, not `inline`: the browser blockifies it anyway\n' +
        '          und der Zaehler landet in einer zweiten Zeile. */}\n' +
        '      <span />\n' +
        '    </div>\n' +
        '  );\n' +
        '}\n',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.trigger).toBe('und');
  });

  test('a regex literal containing // is not a comment', () => {
    // Without a real parser this is the classic false positive: the specs are full of bare regexes.
    expect(src('const re = /Neue Notiz \\/\\/ nicht ein Kommentar/;\n')).toHaveLength(0);
  });

  test('a string containing // is not a comment', () => {
    expect(src("const s = 'https://example.com — nicht der Rede wert';\n")).toHaveLength(0);
  });
});

describe('checkSource — test titles', () => {
  test('flags a German title', () => {
    expect(src("test('zeigt genau drei Spalten', () => {});\n")).toHaveLength(1);
  });

  test('flags a German describe title', () => {
    expect(src("test.describe('Neuer Ordner legt an', () => {});\n")).toHaveLength(1);
  });

  test('passes an English title that names a German UI value', () => {
    // These exist and must keep working: the German is a value, not prose.
    expect(src("test('a failed todo is listed as Aufgabe with its details', () => {});\n")).toHaveLength(0);
    expect(src("test('default expiry preset is 1 Woche', () => {});\n")).toHaveLength(0);
  });

  test('a German string that is not a title is left alone', () => {
    expect(src("const PALETTE_CHUNK_MARKER = 'Befehlspalette';\n")).toHaveLength(0);
    expect(src("page.getByRole('button', { name: 'Neue Notiz anlegen' });\n")).toHaveLength(0);
  });
});

describe('checkMarkdown', () => {
  test('flags German prose', () => {
    expect(checkMarkdown('Der Bestand steht in den Referenzen unten.\n')).toHaveLength(1);
  });

  test('passes English prose', () => {
    expect(checkMarkdown('The inventory is in the references below.\n')).toHaveLength(0);
  });

  test('skips fenced code blocks', () => {
    expect(checkMarkdown('```\nconst x = "und der Wert";\n```\n')).toHaveLength(0);
  });
});

describe('checkCommitMessage', () => {
  test('rejects German prose', () => {
    expect(checkCommitMessage('Behebt den Fehler beim Speichern')).toHaveLength(1);
  });

  test('accepts English with a quoted German UI string', () => {
    expect(checkCommitMessage('fix(ui): "Unbenannt" no longer overwritten')).toHaveLength(0);
  });

  test("ignores git's own comment lines", () => {
    expect(
      checkCommitMessage('fix(ui): keep the counter inline\n\n# Bitte gib eine Commit-Beschreibung ein.\n'),
    ).toHaveLength(0);
  });
});
