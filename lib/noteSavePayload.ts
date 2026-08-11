import type { UpdateNoteInput } from './offlineNotes';

/**
 * What an autosave actually sends for a note.
 *
 * A blank title is **omitted** rather than sent as `''`: the route validates
 * `title: z.string().min(1).optional()`, so an empty string is a 400 — and a 400 is
 * deterministic, i.e. non-retryable, i.e. the whole entry goes straight to the
 * failed-sync inspector. That lost the *content* from the same request too, because
 * the payload is rejected as a whole.
 *
 * Omitting is valid: both `UpdateNoteInput.title` and the route schema are optional,
 * so this is a partial update and the server keeps the previous title until the user
 * types a real one. NoteHeader normalises a still-blank title to DEFAULT_NOTE_TITLE
 * on blur, so the field and the stored value cannot drift apart for long.
 */
export function buildNoteSavePayload(title: string, content: string): UpdateNoteInput {
  return title.trim() === '' ? { content } : { title, content };
}
