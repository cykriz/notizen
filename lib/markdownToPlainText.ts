import { SPEECH_CHUNK_MAX } from './ttsConstants';

// Prepares note markdown for text-to-speech. Client-safe (no fs/path).
//
// A regex/line-scan rather than a real markdown parser: read-aloud only needs
// natural-sounding text, not structural fidelity, and this avoids adding a
// parser dependency. Mirrors the fenced-code tracking in extractHeadings
// (components/NoteOutline.tsx).

function stripBlockMarkers(line: string): string {
  let s = line.trimEnd();

  // Horizontal rule -> drop
  if (/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(s)) {
    return '';
  }

  // Table separator row (|---|:--:|) -> drop
  if (s.includes('|') && /^[\s|:-]+$/.test(s) && s.includes('-')) {
    return '';
  }

  // Table content row -> read the cells as a comma-separated list
  if (/^\s*\|.*\|?\s*$/.test(s) && s.includes('|')) {
    s = s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').replace(/\s*\|\s*/g, ', ');
  }

  // Blockquote markers
  s = s.replace(/^\s{0,3}>+\s?/, '');

  // Heading -> keep the text, ensure a trailing period so TTS pauses between sections
  const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(s);
  if (heading) {
    const text = heading[2].replace(/\s+#+\s*$/, '').trim();
    if (text === '') {
      return '';
    }

    return /[.!?:]$/.test(text) ? text : `${text}.`;
  }

  // Task checkbox -> strip the box, keep the label (before the generic bullet strip)
  s = s.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1');
  // List bullets (unordered + ordered) -> strip the marker
  s = s.replace(/^(\s*)[-*+]\s+/, '$1');
  s = s.replace(/^(\s*)\d+[.)]\s+/, '$1');

  return s;
}

function stripInline(text: string): string {
  return (
    text
      // Images -> remove entirely (alt is usually a filename)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
      // Links -> keep the visible text, drop the URL
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // Autolinks -> drop
      .replace(/<https?:\/\/[^>]+>/g, '')
      // Inline code -> keep the word, drop the backticks
      .replace(/`([^`]*)`/g, '$1')
      // Emphasis / strong / strikethrough markers
      .replace(/(\*\*|__|\*|_|~~)/g, '')
      // Remaining raw HTML tags
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
  );
}

export function markdownToPlainText(markdown: string, title?: string): string {
  // 1. Strip a leading YAML frontmatter block, if present.
  const withoutFrontmatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  // 2. Line-scan, dropping fenced code blocks entirely (same fence tracking as extractHeadings).
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of withoutFrontmatter.split('\n')) {
    const fenceMatch = /^(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fence === null) {
        fence = marker[0];
      } else if (marker.startsWith(fence)) {
        fence = null;
      }

      continue;
    }

    if (fence !== null) {
      continue;
    }

    out.push(stripBlockMarkers(line));
  }

  // 3. Inline transforms (after block handling so fenced code/images are already gone).
  const inlined = stripInline(out.join('\n'));

  // 4. Normalise whitespace, collapse blank runs.
  const body = inlined.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const prefix = title !== undefined && title.trim() !== '' ? `${title.trim()}. ` : '';
  return (prefix + body).trim();
}

// Hard-splits an overlong run at word boundaries so no chunk exceeds maxLen
// (a single word longer than maxLen is emitted whole — never character-split).
function hardSplitWords(text: string, maxLen: number): string[] {
  const pieces: string[] = [];
  let buffer = '';
  for (const word of text.split(' ')) {
    if (buffer !== '' && buffer.length + 1 + word.length > maxLen) {
      pieces.push(buffer);
      buffer = word;
    } else {
      buffer = buffer === '' ? word : `${buffer} ${word}`;
    }
  }
  if (buffer !== '') {
    pieces.push(buffer);
  }

  return pieces;
}

// Splits a paragraph into sentence-level units, each <= maxLen.
function toSentenceUnits(paragraph: string, maxLen: number): string[] {
  const normalized = paragraph.replace(/\s+/g, ' ').trim();
  if (normalized === '') {
    return [];
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [normalized];
  const units: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (sentence === '') {
      continue;
    }

    if (sentence.length <= maxLen) {
      units.push(sentence);
    } else {
      units.push(...hardSplitWords(sentence, maxLen));
    }
  }
  return units;
}

/**
 * Splits plain text into speakable chunks, preferring paragraph then sentence
 * boundaries and hard-splitting overlong runs at word boundaries. Each chunk
 * stays <= maxLen (unless a single word exceeds it). Feeds the sequential
 * playback queue in useSpeech so long notes are read in full instead of being
 * silently truncated by the browser.
 */
export function splitIntoSpeechChunks(text: string, maxLen: number = SPEECH_CHUNK_MAX): string[] {
  const chunks: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    let buffer = '';
    for (const unit of toSentenceUnits(paragraph, maxLen)) {
      if (buffer !== '' && buffer.length + 1 + unit.length > maxLen) {
        chunks.push(buffer);
        buffer = unit;
      } else {
        buffer = buffer === '' ? unit : `${buffer} ${unit}`;
      }
    }
    if (buffer !== '') {
      chunks.push(buffer);
    }
  }
  return chunks;
}
