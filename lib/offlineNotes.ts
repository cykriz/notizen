import { SYNC_ACTION, SYNC_ENTITY } from '@/lib/constants';
import {
  getCachedNote,
  getCachedNotesList,
  removeCachedNote,
  setCachedNote,
  setCachedNotesList,
} from '@/lib/localCache';
import { NoteResponseSchema, reportUnreadableResponse } from '@/lib/schemas';
import { deleteEntityOffline, sendOrQueue } from '@/lib/offlineWrite';
import { upsertById } from '@/lib/offlineAdopt';
import type { Note, NoteSummary } from '@/lib/types';

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

/**
 * Writes the server's own row over the optimistic one — see upsertById for why
 * this matters and why it reads the current cache. Notes prepend (newest first)
 * and carry a second cache entry for their content.
 */
function adoptServerNote(
  body: unknown,
  fallback: NoteSummary[],
): { entity: Note | null; list: NoteSummary[] } {
  const parsed = NoteResponseSchema.safeParse(body);
  if (!parsed.success) {
    // See adoptServerTodo: the write landed, the answer is unreadable.
    reportUnreadableResponse('adoptServerNote', body);
    return { entity: null, list: fallback };
  }

  const server = parsed.data;
  setCachedNote(server);
  const merged = upsertById(getCachedNotesList(), noteToSummary(server), 'start');
  setCachedNotesList(merged);
  return { entity: server, list: merged };
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
    id,
    slug: '',
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
    attachmentCount: 0,
    attachments: [],
  };

  setCachedNote(note);
  const updatedList = [noteToSummary(note), ...currentNotes];
  setCachedNotesList(updatedList);

  const payload = { id, title: input.title, content: input.content, tags: input.tags ?? [] };
  const result = await sendOrQueue(
    { entityType: SYNC_ENTITY.NOTE, entityId: id, action: SYNC_ACTION.CREATE, payload, timestamp: now },
    { url: '/api/notes', method: 'POST', body: payload },
    isOnline,
  );

  if (result.outcome !== 'ok') {
    return { note, updatedList };
  }

  const { entity, list } = adoptServerNote(result.body, updatedList);
  return { note: entity ?? note, updatedList: list };
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
  const existingSummary = currentNotes.find((n) => n.id === id);

  // Only update individual note cache when we have real content to preserve.
  // Metadata-only updates (pin, tags) without a cached note must not write
  // content: '' — that would cause data loss if read offline.
  if (existing !== null) {
    setCachedNote({ ...existing, ...input, updatedAt: now });
  } else if (input.content !== undefined && existingSummary) {
    setCachedNote({
      id,
      slug: existingSummary.slug,
      title: input.title ?? existingSummary.title,
      content: input.content,
      tags: input.tags ?? existingSummary.tags,
      pinned: input.pinned ?? existingSummary.pinned,
      createdAt: existingSummary.createdAt,
      updatedAt: now,
      attachmentCount: existingSummary.attachmentCount,
      attachments: [],
    });
  }

  const updatedList = currentNotes.map((n) => (n.id === id ? { ...n, ...input, updatedAt: now } : n));
  setCachedNotesList(updatedList);

  const payload = { ...input };
  const result = await sendOrQueue(
    { entityType: SYNC_ENTITY.NOTE, entityId: id, action: SYNC_ACTION.UPDATE, payload, timestamp: now },
    {
      url: `/api/notes/${id}`,
      method: 'PUT',
      body: payload,
      expectedUpdatedAt: existing?.updatedAt ?? existingSummary?.updatedAt,
    },
    isOnline,
  );

  return result.outcome === 'ok' ? adoptServerNote(result.body, updatedList).list : updatedList;
}

export function deleteNoteOffline(
  id: string,
  currentNotes: NoteSummary[],
  isOnline: boolean,
): Promise<NoteSummary[]> {
  // Notes carry a second cache entry for their content, dropped before the
  // shared path handles the list row, the tombstone and the request.
  removeCachedNote(id);
  return deleteEntityOffline(id, currentNotes, isOnline, {
    entityType: SYNC_ENTITY.NOTE,
    baseUrl: '/api/notes',
    writeCache: setCachedNotesList,
  });
}
