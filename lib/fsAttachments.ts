import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Attachment } from './types';
import { attachmentDownloadPath } from './attachmentUpload';
import { isImageMime } from './mediaTypes';
import {
  NotFoundError,
  attachmentsDir,
  ensureDir,
  findSlugByNoteId,
  guessMimeType,
} from './fsHelpers';

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
    const files = await fs.readdir(attDir);
    const attachments: Attachment[] = [];

    for (const file of files) {
      const filePath = path.join(attDir, file);
      const stat = await fs.stat(filePath);
      const sep = file.indexOf('_');
      const attId = sep !== -1 ? file.slice(0, sep) : file;
      const originalName = sep !== -1 ? file.slice(sep + 1) : file;

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

export async function getAttachmentFilePath(
  noteId: string,
  attId: string,
  root: string,
): Promise<{ filePath: string; fileName: string; mimeType: string }> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    throw new NotFoundError(`Note not found: ${noteId}`);
  }

  const attDir = attachmentsDir(slug, root);
  let files: string[];
  try {
    files = await fs.readdir(attDir);
  } catch {
    throw new NotFoundError(`Attachment not found: ${attId}`);
  }
  const target = files.find((f) => f.startsWith(`${attId}_`));
  if (target === undefined) {
    throw new NotFoundError(`Attachment not found: ${attId}`);
  }

  const sep = target.indexOf('_');
  const originalName = sep !== -1 ? target.slice(sep + 1) : target;

  return {
    filePath: path.join(attDir, target),
    fileName: originalName,
    mimeType: guessMimeType(originalName),
  };
}

export async function deleteAttachment(
  noteId: string,
  attId: string,
  root: string,
): Promise<void> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    throw new NotFoundError(`Note not found: ${noteId}`);
  }

  const attDir = attachmentsDir(slug, root);
  let files: string[];
  try {
    files = await fs.readdir(attDir);
  } catch {
    throw new NotFoundError(`Attachment not found: ${attId}`);
  }
  const target = files.find((f) => f.startsWith(`${attId}_`));
  if (target === undefined) {
    throw new NotFoundError(`Attachment not found: ${attId}`);
  }

  await fs.rm(path.join(attDir, target));
}
