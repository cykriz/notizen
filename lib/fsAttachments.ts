import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Attachment } from './types';
import { ATT_ID_PATTERN, attachmentDownloadPath } from './attachmentUpload';
import { isImageMime } from './mediaTypes';
import {
  NotFoundError,
  attachmentsDir,
  ensureDir,
  findSlugByNoteId,
  guessMimeType,
} from './fsHelpers';

const ATT_ID_RE = new RegExp(`^${ATT_ID_PATTERN}$`);
const STORED_NAME_RE = new RegExp(`^${ATT_ID_PATTERN}_.+`);

/**
 * Whether a dirent in an attachments dir is one saveAttachment wrote
 * (`<attId>_<originalName>`). Everything else, such as Synology's `@eaDir`,
 * `.DS_Store` or AppleDouble `._…` files, belongs to the host and is skipped.
 */
export function isStoredAttachment(entry: Dirent): boolean {
  return entry.isFile() && STORED_NAME_RE.test(entry.name);
}

export async function readStoredAttachments(attDir: string): Promise<string[]> {
  const entries = await fs.readdir(attDir, { withFileTypes: true });
  return entries.filter(isStoredAttachment).map((e) => e.name);
}

export async function listAttachments(noteId: string, root: string): Promise<Attachment[]> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    return [];
  }

  return await listAttachmentsBySlug(slug, root);
}

// Slug-based half of listAttachments, for listNotes, which already holds the
// slug and would otherwise resolve it again per note.
export async function listAttachmentsBySlug(slug: string, root: string): Promise<Attachment[]> {
  const attDir = attachmentsDir(slug, root);
  try {
    const files = await readStoredAttachments(attDir);
    const attachments: Attachment[] = [];

    for (const file of files) {
      const filePath = path.join(attDir, file);
      const stat = await fs.stat(filePath);
      const sep = file.indexOf('_');
      const attId = file.slice(0, sep);
      const originalName = file.slice(sep + 1);

      attachments.push({
        id: attId,
        originalName,
        mimeType: guessMimeType(originalName),
        size: stat.size,
        relativePath: `attachments/${file}`,
      });
    }

    return attachments;
  } catch {
    return [];
  }
}

/**
 * The sidebar count: what the note visibly has. Non-image files are listed
 * under the editor; an image shows only while its link is in the body, so an
 * image that was never linked (or predates deleteRemovedImages) no longer
 * counts. Any link form counts, since the download URL is the unique anchor.
 */
export function countVisibleAttachments(
  attachments: Attachment[],
  content: string,
  noteId: string,
): number {
  return attachments.filter(
    (a) => !isImageMime(a.mimeType) || content.includes(attachmentDownloadPath(noteId, a.id)),
  ).length;
}

export async function saveAttachment(
  noteId: string,
  file: File,
  root: string,
): Promise<Attachment> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    throw new NotFoundError(`Note not found: ${noteId}`);
  }

  const attId = uuidv4().split('-')[0];
  const storedName = `${attId}_${file.name}`;
  const attDir = attachmentsDir(slug, root);
  await ensureDir(attDir);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(attDir, storedName), buffer);

  return {
    id: attId,
    originalName: file.name,
    mimeType: file.type !== '' ? file.type : guessMimeType(file.name),
    size: file.size,
    relativePath: `attachments/${storedName}`,
  };
}

// Shared lookup for download and delete, so both apply listAttachments' rule.
async function findStoredAttachment(
  noteId: string,
  attId: string,
  root: string,
): Promise<{ attDir: string; name: string }> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    throw new NotFoundError(`Note not found: ${noteId}`);
  }

  const notFound = new NotFoundError(`Attachment not found: ${attId}`);
  if (!ATT_ID_RE.test(attId)) {
    throw notFound;
  }

  const attDir = attachmentsDir(slug, root);
  let files: string[];
  try {
    files = await readStoredAttachments(attDir);
  } catch {
    throw notFound;
  }
  const name = files.find((f) => f.startsWith(`${attId}_`));
  if (name === undefined) {
    throw notFound;
  }

  return { attDir, name };
}

export async function getAttachmentFilePath(
  noteId: string,
  attId: string,
  root: string,
): Promise<{ filePath: string; fileName: string; mimeType: string }> {
  const { attDir, name } = await findStoredAttachment(noteId, attId, root);
  const originalName = name.slice(name.indexOf('_') + 1);

  return {
    filePath: path.join(attDir, name),
    fileName: originalName,
    mimeType: guessMimeType(originalName),
  };
}

export async function deleteAttachment(
  noteId: string,
  attId: string,
  root: string,
): Promise<void> {
  const { attDir, name } = await findStoredAttachment(noteId, attId, root);
  await fs.rm(path.join(attDir, name));
}
