import { ATT_ID_PATTERN } from './attachmentUpload';
import { escapeRegex } from './escapeRegex';

// Rewrites attachment URLs in a note's markdown body so anonymous viewers
// can fetch them via /share/{token}/attachments/:attId. Relies on the
// invariant that all in-body attachment URLs carry the "/download" suffix
// (built by lib/attachmentUpload.ts › attachmentDownloadPath, which every
// in-body link goes through via buildMarkdownLink).
// attId follows ATT_ID_PATTERN; noteId is a UUID, but we
// still escape regex metachars defensively in case a non-UUID id is ever
// passed in.
export function rewriteAttachmentUrlsForShare(
  content: string,
  noteId: string,
  token: string,
): string {
  const pattern = new RegExp(
    `/api/notes/${escapeRegex(noteId)}/attachments/(${ATT_ID_PATTERN})/download`,
    'g',
  );
  return content.replace(pattern, `/share/${token}/attachments/$1`);
}
