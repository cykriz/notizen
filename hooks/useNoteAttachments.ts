import { useCallback, useMemo, useState, type RefObject } from 'react';

import { appendLinks, removeAttachmentLink } from '@/lib/attachmentUpload';
import type { Attachment } from '@/lib/fsNotes';
import type { AttachmentChange } from '@/lib/offlineAttachments';

interface UseNoteAttachmentsOptions {
  noteId: string;
  initialAttachments: Attachment[];
  // Current note content + setter — needed to insert links on upload and to
  // strip the dead link from the body when an attachment is deleted.
  contentRef: RefObject<string>;
  onContentChange: (value: string) => void;
  // Reports the change to the shared note list so the sidebar badge follows —
  // nothing else does, see lib/offlineAttachments.ts. Same signature as the
  // context action, so NoteEditor can pass it straight through.
  onAttachmentChange: (noteId: string, change: AttachmentChange) => void;
}

export function useNoteAttachments({
  noteId,
  initialAttachments,
  contentRef,
  onContentChange,
  onAttachmentChange,
}: UseNoteAttachmentsOptions) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);

  const nonImageAttachments = useMemo(
    () => attachments.filter((a) => !a.mimeType.startsWith('image/')),
    [attachments],
  );

  const handleUploaded = useCallback(
    (att: Attachment) => {
      setAttachments((prev) => [...prev, att]);
      onAttachmentChange(noteId, { added: att });
    },
    [noteId, onAttachmentChange],
  );

  const handleInsertLinks = useCallback(
    (links: string[]) => {
      onContentChange(appendLinks(contentRef.current, links));
    },
    [contentRef, onContentChange],
  );

  const handleAttachmentDeleted = useCallback(
    (attId: string) => {
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      onAttachmentChange(noteId, { removedId: attId });
      const next = removeAttachmentLink(contentRef.current, attId, noteId);
      if (next !== contentRef.current) {
        onContentChange(next);
      }
    },
    [contentRef, noteId, onAttachmentChange, onContentChange],
  );

  return { nonImageAttachments, handleUploaded, handleInsertLinks, handleAttachmentDeleted };
}
