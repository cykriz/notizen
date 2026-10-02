import fs from 'fs/promises';
import path from 'path';
import type { Attachment } from './types';
import { attachmentDownloadPath } from './attachmentUpload';
import { listAttachmentsBySlug } from './fsAttachments';
import { noteDir, notesDir, readFrontmatterFile, trashNotesDir } from './fsHelpers';
import { isImageMime } from './mediaTypes';

/**
 * Deletes the image files whose link a save took out of the body and returns
 * what is left. Images have no delete button (the editor lists non-images
 * only), so removing the line is how the user deletes one.
 *
 * Only links present in `oldContent` qualify: an upload writes its file before
 * the link reaches a save, so "unlinked" alone would delete a fresh image. A
 * link copied into another note keeps the file — the URL carries this note's
 * id, so the other note would render a broken image.
 */
export async function deleteRemovedImages(
  noteId: string,
  slug: string,
  oldContent: string,
  newContent: string,
  root: string,
): Promise<Attachment[]> {
  const attachments = await listAttachmentsBySlug(slug, root);
  const removed = attachments.filter((a) => {
    const url = attachmentDownloadPath(noteId, a.id);
    return isImageMime(a.mimeType) && oldContent.includes(url) && !newContent.includes(url);
  });
  if (removed.length === 0) {
    return attachments;
  }

  const otherBodies = await readOtherNoteBodies(slug, root);
  const deleted = new Set<string>();
  for (const att of removed) {
    const url = attachmentDownloadPath(noteId, att.id);
    if (!otherBodies.some((body) => body.includes(url))) {
      await fs.rm(path.join(noteDir(slug, root), att.relativePath), { force: true });
      deleted.add(att.id);
    }
  }

  return attachments.filter((a) => !deleted.has(a.id));
}

// Trashed notes count too: a restore would otherwise bring back a broken image.
async function readOtherNoteBodies(slug: string, root: string): Promise<string[]> {
  const bodies: string[] = [];
  for (const dir of [notesDir(root), trashNotesDir(root)]) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (!e.isDirectory() || (dir === notesDir(root) && e.name === slug)) {
        continue;
      }

      const parsed = await readFrontmatterFile(path.join(dir, e.name, 'note.md'));
      if (parsed !== null) {
        bodies.push(parsed.content);
      }
    }
  }

  return bodies;
}
