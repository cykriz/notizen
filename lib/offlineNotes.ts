import type { Note, NoteSummary } from "@/lib/types";
import {
  addTombstone,
  getCachedNote,
  removeCachedNote,
  setCachedNote,
  setCachedNotesList,
} from "@/lib/localCache";
import { SYNC_ACTION, SYNC_ENTITY } from "@/lib/constants";
import { enqueueMutation, hasPendingForEntity, hasPendingCreate, clearPendingForEntity } from "@/lib/syncQueue";
import { tryFetch } from "@/lib/tryFetch";
import { NoteResponseSchema } from "@/lib/schemas";

function noteToSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    slug: note.slug,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    attachmentCount: note.attachmentCount,
    tags: note.tags,
    pinned: note.pinned,
  };
}

export interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string[];
}

export async function createNoteOffline(
  input: CreateNoteInput,
  currentNotes: NoteSummary[],
  isOnline: boolean,
): Promise<{ note: Note; updatedList: NoteSummary[] }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const note: Note = {
    id, slug: "", title: input.title, content: input.content,
    tags: input.tags ?? [], pinned: false, createdAt: now, updatedAt: now,
    attachmentCount: 0, attachments: [],
  };

  setCachedNote(note);
  const updatedList = [noteToSummary(note), ...currentNotes];
  setCachedNotesList(updatedList);

  const payload = { id, title: input.title, content: input.content, tags: input.tags ?? [] };
  const entry = { entityType: SYNC_ENTITY.NOTE, entityId: id, action: SYNC_ACTION.CREATE, payload, timestamp: now };

  // If online and no pending queue entries for this entity, try direct API call.
  // Only enqueue on network failure (null response). Server errors (4xx/5xx) are not retryable.
  if (isOnline && !hasPendingForEntity(id)) {
    const res = await tryFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res === null) {
      enqueueMutation(entry);
    } else if (!res.ok) {
      console.error(`createNoteOffline: server returned ${res.status.toString()}`);
    } else {
      const serverNote = NoteResponseSchema.parse(await res.json());
      setCachedNote(serverNote);
      const serverList = updatedList.map((n) => n.id === id ? noteToSummary(serverNote) : n);
      setCachedNotesList(serverList);
      return { note: serverNote, updatedList: serverList };
    }
  } else {
    enqueueMutation(entry);
  }

  return { note, updatedList };
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
}

export async function updateNoteOffline(
  id: string,
  input: UpdateNoteInput,
  currentNotes: NoteSummary[],
  isOnline: boolean,
): Promise<NoteSummary[]> {
  const now = new Date().toISOString();
  const existing = getCachedNote(id);

  if (existing !== null) {
    setCachedNote({ ...existing, ...input, updatedAt: now });
  }

  const updatedList = currentNotes.map((n) => n.id === id ? { ...n, ...input, updatedAt: now } : n);
  setCachedNotesList(updatedList);

  const payload = { ...input };
  const entry = { entityType: SYNC_ENTITY.NOTE, entityId: id, action: SYNC_ACTION.UPDATE, payload, timestamp: now };

  // Skip direct API if queue has pending mutations for this entity (preserves ordering)
  if (isOnline && !hasPendingForEntity(id)) {
    const expectedUpdatedAt = existing?.updatedAt ?? currentNotes.find((n) => n.id === id)?.updatedAt;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (expectedUpdatedAt !== undefined) {
      headers["X-Expected-UpdatedAt"] = expectedUpdatedAt;
    }

    const res = await tryFetch(`/api/notes/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (res === null) {
      enqueueMutation(entry);
    }
  } else {
    enqueueMutation(entry);
  }

  return updatedList;
}

export async function deleteNoteOffline(
  id: string,
  currentNotes: NoteSummary[],
  isOnline: boolean,
): Promise<NoteSummary[]> {
  const now = new Date().toISOString();
  removeCachedNote(id);
  addTombstone(id);
  const updatedList = currentNotes.filter((n) => n.id !== id);
  setCachedNotesList(updatedList);

  // If the note was created offline and never synced, just clear the queue —
  // no need to send a delete to the server for something it never received.
  if (hasPendingCreate(id)) {
    clearPendingForEntity(id);
    return updatedList;
  }

  const entry = { entityType: SYNC_ENTITY.NOTE, entityId: id, action: SYNC_ACTION.DELETE, payload: {}, timestamp: now };

  if (isOnline && !hasPendingForEntity(id)) {
    const res = await tryFetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res === null) {
      enqueueMutation(entry);
    }
  } else {
    enqueueMutation(entry);
  }

  return updatedList;
}
