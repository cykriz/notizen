import { useState, useCallback, type RefObject } from 'react';
import { insertAtCursor } from '@/lib/editorInsert';
import type { Attachment } from '@/lib/fsNotes';

function buildMarkdownLink(att: Attachment, noteId: string): string {
  const url = `/api/notes/${noteId}/attachments/${att.id}/download`;
  if (att.mimeType.startsWith('image/')) {
    return `![${att.originalName}](${url})`;
  }

  return `[${att.originalName}](${url})`;
}

interface UseFileDropOptions {
  noteId?: string;
  value: string;
  onChange: (v: string) => void;
  onFileUploaded?: (attachment: Attachment) => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export function useFileDrop({ noteId, value, onChange, onFileUploaded, wrapperRef }: UseFileDropOptions) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (noteId === undefined || noteId === '' || e.dataTransfer.files.length === 0) {
        return;
      }

      setUploading(true);
      try {
        const links: string[] = [];
        for (const file of Array.from(e.dataTransfer.files)) {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch(`/api/notes/${noteId}/attachments`, { method: 'POST', body: form });
          if (res.ok) {
            const att = (await res.json()) as Attachment;
            onFileUploaded?.(att);
            links.push(buildMarkdownLink(att, noteId));
          }
        }
        if (links.length > 0) {
          const textarea = wrapperRef.current?.querySelector('textarea');
          const pos = textarea?.selectionStart ?? value.length;
          onChange(insertAtCursor(value, pos, links.join('\n')));
        }
      } finally {
        setUploading(false);
      }
    },
    [noteId, value, onChange, onFileUploaded, wrapperRef],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (noteId !== undefined && noteId !== '') {
        setDragging(true);
      }
    },
    [noteId],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node)) {
        setDragging(false);
      }
    },
    [wrapperRef],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageFiles = items
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (imageFiles.length === 0 || noteId === undefined || noteId === '') {
        return;
      }

      e.preventDefault();
      setUploading(true);
      try {
        const links: string[] = [];
        for (const file of imageFiles) {
          const form = new FormData();
          form.append('file', file);
          const res = await fetch(`/api/notes/${noteId}/attachments`, { method: 'POST', body: form });
          if (res.ok) {
            const att = (await res.json()) as Attachment;
            onFileUploaded?.(att);
            links.push(buildMarkdownLink(att, noteId));
          }
        }
        if (links.length > 0) {
          const textarea = wrapperRef.current?.querySelector('textarea');
          const pos = textarea?.selectionStart ?? value.length;
          onChange(insertAtCursor(value, pos, links.join('\n')));
        }
      } finally {
        setUploading(false);
      }
    },
    [noteId, value, onChange, onFileUploaded, wrapperRef],
  );

  return { dragging, uploading, handleDrop, handleDragOver, handleDragLeave, handlePaste };
}
