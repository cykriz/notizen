// Client-safe media detection — no `fs`/`path` imports so this can be bundled
// into the browser (used by the markdown preview renderer). The server-side
// `guessMimeType` (lib/fsHelpers.ts) imports these lists so the supported
// audio/video extensions live in exactly one place.

export type MediaKind = 'audio' | 'video';

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'] as const;
export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const;

function extname(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

/** Returns the media kind for a filename based on its extension, or null. */
export function mediaKindForFilename(filename: string): MediaKind | null {
  const ext = extname(filename);
  if ((AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'audio';
  }

  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'video';
  }

  return null;
}
