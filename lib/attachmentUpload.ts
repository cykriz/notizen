import { escapeRegex } from '@/lib/escapeRegex';
import type { Attachment } from '@/lib/fsNotes';

// Single source of truth for the in-body attachment URL shape. The "/download"
// suffix is an invariant relied on by lib/shareContent.ts (regex form).
export function attachmentDownloadPath(noteId: string, attId: string): string {
  return `/api/notes/${noteId}/attachments/${attId}/download`;
}

export function buildMarkdownLink(att: Attachment, noteId: string): string {
  const url = attachmentDownloadPath(noteId, att.id);
  if (att.mimeType.startsWith('image/')) {
    return `![${att.originalName}](${url})`;
  }

  return `[${att.originalName}](${url})`;
}

export interface UploadResult {
  links: string[];
  failed: number;
}

export async function uploadFiles(
  files: File[],
  noteId: string,
  onUploaded?: (att: Attachment) => void,
): Promise<UploadResult> {
  const links: string[] = [];
  let failed = 0;
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`/api/notes/${noteId}/attachments`, { method: 'POST', body: form });
      if (res.ok) {
        const att = (await res.json()) as Attachment;
        onUploaded?.(att);
        links.push(buildMarkdownLink(att, noteId));
      } else {
        // Server responded but rejected (e.g. 413 payload too large).
        failed += 1;
      }
    } catch {
      // Network-level failure.
      failed += 1;
    }
  }
  return { links, failed };
}

export function appendLinks(content: string, links: string[]): string {
  if (links.length === 0) {
    return content;
  }

  const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  return `${content}${sep}${links.join('\n')}\n`;
}

// Removes the markdown link(s) pointing at a given attachment's download URL
// (both `[name](url)` and image `![name](url)` forms). The URL is the unique
// anchor, so a non-greedy link-text match also tolerates `]` in the filename.
// Links typically sit alone on their own line (appendLinks/insertLinks add
// them with `\n`), so own-line matches are removed together with their newline
// to avoid leaving blank lines; inline occurrences are stripped in place.
export function removeAttachmentLink(content: string, attId: string, noteId: string): string {
  const url = attachmentDownloadPath(noteId, attId);
  const link = `!?\\[[^\\n]*?\\]\\(${escapeRegex(url)}\\)`;
  return content
    .replace(new RegExp(`^[ \\t]*${link}[ \\t]*\\r?\\n`, 'gm'), '')
    .replace(new RegExp(`\\r?\\n[ \\t]*${link}[ \\t]*$`, 'g'), '')
    .replace(new RegExp(link, 'g'), '');
}
