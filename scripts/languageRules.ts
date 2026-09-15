/**
 * German detector for developer-facing text.
 *
 * `CLAUDE.md` § Key Rules puts the boundary between the UI and the codebase, not between file types:
 * comments, test titles, identifiers and docs are English; German survives only as UI text. This
 * module carries the predicate and the extractors; the CLI in `check-language.ts` walks the files.
 *
 * The predicate is deliberately narrow — an umlaut or a German stopword, both only *outside* quoted
 * spans. Quoted German is a citation of UI copy and legitimate (`// "Papierkorb konnte nicht geprüft
 * werden"` inside English prose), so quotes are stripped before the test. It follows that a German
 * noun phrase carrying neither umlaut nor stopword (`// --- Papierkorb (Trash) ---`) slips past;
 * `.claude/review/checks.md` § "Style & Conventions" hands that residue to the review agent.
 */
import ts from 'typescript';

/**
 * German-only words: function words, plus verbs, adjectives and numerals. Nouns are deliberately
 * absent — `Aufgabe`, `Papierkorb` and `Woche` name UI values and appear in perfectly English test
 * titles ("a failed todo is listed as Aufgabe with its details"), so a noun cannot tell the two
 * languages apart. A verb can.
 *
 * Every entry is checked against English: `die`, `den`, `man`, `war`, `also`, `so`, `in`, `an`, `am`
 * are common English words and are therefore absent on purpose — one of them cost a false positive
 * on `clearSwCaches.ts` ("an await could die with the document").
 *
 * Measured against the 37 titles this repo had before the translation: 34 caught, and none of the six
 * English titles that name a German value flagged. The residue is bare German compound labels with no
 * verb and no function word (`Befehlspalette`, `ToDo-Board`, `Service-Worker-Precache`), which no
 * wordlist predicate reaches;
 * `.claude/review/checks.md` § "Style & Conventions" routes that class to the review agent.
 */
const STOPWORDS = [
  // function words
  'nicht', 'und', 'oder', 'aber', 'sondern', 'der', 'dem', 'des', 'das', 'dass', 'eine', 'einen',
  'einem', 'einer', 'wenn', 'weil', 'damit', 'sich', 'für', 'über', 'ohne', 'beim', 'bei', 'nach',
  'auch', 'noch', 'schon', 'bereits', 'jede', 'jeder', 'jedes', 'alle', 'allen', 'aller', 'immer',
  'statt', 'gegen', 'durch', 'zwischen', 'dabei', 'dadurch', 'deshalb', 'sonst', 'hier', 'dort',
  'mehr', 'sehr', 'etwa', 'jeweils', 'sowie', 'ich', 'wir', 'sie', 'ihre', 'ihren',
  // verbs
  'wird', 'werden', 'wurde', 'wurden', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen', 'darf',
  'dürfen', 'ist', 'sind', 'hat', 'haben', 'liegt', 'liegen', 'steht', 'stehen', 'gibt', 'macht',
  'zeigt', 'zeigen', 'legt', 'legen', 'leeren', 'verschiebt', 'verschieben', 'bleibt', 'bringt',
  'schiebt', 'sperrt', 'klappt', 'landet', 'springt', 'trifft', 'findet', 'bietet', 'setzt',
  // adjectives and numerals
  'neuer', 'neue', 'neuen', 'neues', 'genau', 'zwei', 'drei', 'vier',
] as const;

const UMLAUT = /[äöüßÄÖÜ]/;
const STOPWORD_RE = new RegExp(`\\b(${STOPWORDS.join('|')})\\b`, 'i');

/**
 * Quoted spans carry UI copy, not prose — backticks, `"…"`, `„…“`, `»…«` and `'…'` all drop out.
 *
 * The single-quote pass requires a non-word character before the opening quote: without it two
 * apostrophes on one line pair up and blank everything between them ("don't … the caller's job"),
 * which would hide any German sitting in the middle.
 */
function stripQuoted(text: string): string {
  return text
    .replace(/`[^`]*`/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/„[^“"]*[“"]/g, ' ')
    .replace(/»[^«]*«/g, ' ')
    .replace(/(^|[^\p{L}\p{N}])'[^'\n]*'/gu, '$1 ');
}

/** The word or character that makes this text German, or `null` if it reads as English. */
export function germanTrigger(text: string): string | null {
  const bare = stripQuoted(text);
  return UMLAUT.exec(bare)?.[0] ?? STOPWORD_RE.exec(bare)?.[0] ?? null;
}

export interface Hit {
  line: number;
  trigger: string;
  text: string;
}

function hitFor(source: string, pos: number, text: string): Hit | null {
  const trigger = germanTrigger(text);
  if (trigger === null) {
    return null;
  }

  const line = source.slice(0, pos).split('\n').length;
  return { line, trigger, text: text.split('\n')[0]?.trim() ?? '' };
}

const TITLE_CALLERS = new Set(['test', 'it', 'describe']);

/** `test(...)`, `it(...)`, `describe(...)`, `test.describe(...)`, `test.step(...)`. */
function isTitleCall(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr)) {
    return TITLE_CALLERS.has(expr.text);
  }

  if (ts.isPropertyAccessExpression(expr)) {
    const root = ts.isIdentifier(expr.expression) ? expr.expression.text : '';
    return TITLE_CALLERS.has(root) && ['describe', 'step', 'only', 'skip', 'fixme'].includes(expr.name.text);
  }

  return false;
}

/**
 * Every comment in the file, JSX `{/* … *\/}` included.
 *
 * The walk uses `getChildren()`, not `forEachChild()`, and that is the whole point: a JSX expression
 * holding nothing but a comment has no child *node*, so under `forEachChild` its comment is trivia of
 * nobody and vanishes. `getChildren()` also yields the syntax tokens — the closing `}` carries the
 * comment as its leading trivia. Verified against a multi-line JSX comment; a line-anchored regex
 * cannot see one at all, since its continuation lines carry no marker.
 */
function commentRanges(source: string, file: ts.SourceFile): ts.CommentRange[] {
  const seen = new Set<number>();
  const out: ts.CommentRange[] = [];
  const visit = (node: ts.Node): void => {
    for (const range of [
      ...(ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(source, node.getEnd()) ?? []),
    ]) {
      if (seen.has(range.pos)) {
        continue;
      }

      seen.add(range.pos);
      out.push(range);
    }
    for (const child of node.getChildren(file)) {
      visit(child);
    }
  };
  for (const child of file.getChildren(file)) {
    visit(child);
  }
  return out;
}

/** German comments and German test titles in one TypeScript/TSX source. */
export function checkSource(fileName: string, source: string): Hit[] {
  // ScriptKind follows the extension: parsing a .ts file as TSX turns a generic arrow (`<T>(x) => x`)
  // into unterminated JSX, and the comments around it are then lost silently.
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const hits: Hit[] = [];

  for (const range of commentRanges(source, file)) {
    const hit = hitFor(source, range.pos, source.slice(range.pos, range.end));
    if (hit) {
      hits.push(hit);
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isTitleCall(node.expression) && node.arguments.length > 0) {
      const title = node.arguments[0];
      if (ts.isStringLiteralLike(title)) {
        const hit = hitFor(source, title.getStart(file), title.text);
        if (hit) {
          hits.push(hit);
        }
      }
    }

    node.forEachChild(visit);
  };
  file.forEachChild(visit);

  return hits.sort((a, b) => a.line - b.line);
}

/** German prose in markdown. Fenced blocks drop out; inline code is handled by `stripQuoted`. */
export function checkMarkdown(source: string): Hit[] {
  const hits: Hit[] = [];
  let fenced = false;
  source.split('\n').forEach((text, i) => {
    if (/^\s*(```|~~~)/.test(text)) {
      fenced = !fenced;
      return;
    }

    if (fenced) {
      return;
    }

    const trigger = germanTrigger(text);
    if (trigger !== null) {
      hits.push({ line: i + 1, trigger, text: text.trim() });
    }
  });
  return hits;
}

/** A commit message. Comment lines (`#`) are git's own template and never reach the log. */
export function checkCommitMessage(message: string): Hit[] {
  const body = message
    .split('\n')
    .filter((l) => !l.startsWith('#'))
    .join('\n');
  const trigger = germanTrigger(body);
  return trigger === null ? [] : [{ line: 1, trigger, text: body.trim().split('\n')[0] ?? '' }];
}
