import type { Attachment } from '@/lib/fsNotes';

export function buildMarkdownLink(att: Attachment, noteId: string): string {
  const url = `/api/notes/${noteId}/attachments/${att.id}/download`;
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
