import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Attachment } from "./types";
import {
  attachmentsDir,
  ensureDir,
  findSlugByNoteId,
  guessMimeType,
} from "./fsHelpers";

export async function listAttachments(noteId: string, root: string): Promise<Attachment[]> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    return [];
  }

  const attDir = attachmentsDir(slug, root);
  try {
    const files = await fs.readdir(attDir);
    const attachments: Attachment[] = [];

    for (const file of files) {
      const filePath = path.join(attDir, file);
      const stat = await fs.stat(filePath);
      const parts = file.split("_", 2);
      const attId = parts[0];
      const originalName = parts.length > 1 ? parts[1] : file;

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

export async function saveAttachment(
  noteId: string,
  file: File,
  root: string,
): Promise<Attachment> {
  const slug = await findSlugByNoteId(noteId, root);
  if (slug === null) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const attId = uuidv4().split("-")[0];
  const storedName = `${attId}_${file.name}`;
  const attDir = attachmentsDir(slug, root);
  await ensureDir(attDir);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(attDir, storedName), buffer);

  return {
    id: attId,
    originalName: file.name,
    mimeType: file.type !== "" ? file.type : guessMimeType(file.name),
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
    throw new Error(`Note not found: ${noteId}`);
  }

  const attDir = attachmentsDir(slug, root);
  let files: string[];
  try {
    files = await fs.readdir(attDir);
  } catch {
    throw new Error(`Attachment not found: ${attId}`);
  }
  const target = files.find((f) => f.startsWith(`${attId}_`));
  if (target === undefined) {
    throw new Error(`Attachment not found: ${attId}`);
  }

  const parts = target.split("_", 2);
  const originalName = parts.length > 1 ? parts[1] : target;

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
    throw new Error(`Note not found: ${noteId}`);
  }

  const attDir = attachmentsDir(slug, root);
  let files: string[];
  try {
    files = await fs.readdir(attDir);
  } catch {
    throw new Error(`Attachment not found: ${attId}`);
  }
  const target = files.find((f) => f.startsWith(`${attId}_`));
  if (target === undefined) {
    throw new Error(`Attachment not found: ${attId}`);
  }

  await fs.rm(path.join(attDir, target));
}
