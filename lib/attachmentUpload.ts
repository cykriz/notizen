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

export interface UploadProgress {
  fileIndex: number; // 1-based, for the "Datei i/n" label
  fileCount: number;
  fileName: string;
  percent: number; // overall progress across all files, 0–100 (clamped)
}

export interface UploadOptions {
  onUploaded?: (att: Attachment) => void;
  onProgress?: (progress: UploadProgress) => void;
}

// Overall percent, byte-weighted. Uses the event fraction (loaded/total of the
// multipart body, which includes overhead) weighted by file.size, and clamps
// to [0,100] so multipart overhead can never push it past 100.
export function computeUploadPercent(
  completedBytes: number,
  currentSize: number,
  eventLoaded: number,
  eventTotal: number,
  totalBytes: number,
): number {
  if (totalBytes <= 0) {
    return 0;
  }

  const frac = eventTotal > 0 ? Math.min(eventLoaded / eventTotal, 1) : 0;
  const done = completedBytes + currentSize * frac;
  return Math.min(100, Math.max(0, Math.round((done / totalBytes) * 100)));
}

// Single source of the repeated status literal (constants rule).
export function formatUploadLabel(p: UploadProgress): string {
  return `Datei ${String(p.fileIndex)}/${String(p.fileCount)}: ${p.fileName}`;
}

// Uploads a single file via XMLHttpRequest (fetch lacks upload progress events).
// Resolves to the created Attachment, or null on any non-2xx / network error.
function uploadOne(
  file: File,
  noteId: string,
  onByteProgress: (loaded: number, total: number) => void,
): Promise<Attachment | null> {
  return new Promise((resolve) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/notes/${noteId}/attachments`);
    // Do not set Content-Type — the browser adds the multipart boundary.
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onByteProgress(e.loaded, e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Attachment);
        } catch {
          resolve(null);
        }
      } else {
        // Server responded but rejected (e.g. 413 payload too large).
        resolve(null);
      }
    };
    xhr.onerror = () => {
      resolve(null);
    };
    xhr.onabort = () => {
      resolve(null);
    };
    xhr.send(form);
  });
}

export async function uploadFiles(
  files: File[],
  noteId: string,
  options?: UploadOptions,
): Promise<UploadResult> {
  const links: string[] = [];
  let failed = 0;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  let completedBytes = 0;
  // Avoid redundant React state churn: only emit when the rounded percent or
  // the current file changes (the latter so a per-file label switch at an
  // unchanged overall percent is not swallowed).
  let lastPercent = -1;
  let lastIndex = -1;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const report = (loaded: number, total: number) => {
      const percent = computeUploadPercent(completedBytes, file.size, loaded, total, totalBytes);
      if (percent === lastPercent && i === lastIndex) {
        return;
      }

      lastPercent = percent;
      lastIndex = i;
      options?.onProgress?.({ fileIndex: i + 1, fileCount: files.length, fileName: file.name, percent });
    };

    const att = await uploadOne(file, noteId, report);
    if (att !== null) {
      options?.onUploaded?.(att);
      links.push(buildMarkdownLink(att, noteId));
    } else {
      failed += 1;
    }

    completedBytes += file.size;
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
