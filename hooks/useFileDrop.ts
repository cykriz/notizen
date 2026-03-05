import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';
import { insertAtCursor } from '@/lib/editorInsert';
import type { Attachment } from '@/lib/fsNotes';

function buildMarkdownLink(att: Attachment, noteId: string): string {
  const url = `/api/notes/${noteId}/attachments/${att.id}/download`;
  if (att.mimeType.startsWith('image/')) {
    return `![${att.originalName}](${url})`;
  }

  return `[${att.originalName}](${url})`;
}

interface UploadContext {
  noteId: string;
  wrapperRef: RefObject<HTMLDivElement | null>;
  valueRef: React.RefObject<string>;
  onChangeRef: React.RefObject<(v: string) => void>;
  onFileUploadedRef: React.RefObject<((att: Attachment) => void) | undefined>;
}

async function uploadAndInsert(files: File[], ctx: UploadContext): Promise<void> {
  const links: string[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/notes/${ctx.noteId}/attachments`, { method: 'POST', body: form });
    if (res.ok) {
      const att = (await res.json()) as Attachment;
      ctx.onFileUploadedRef.current?.(att);
      links.push(buildMarkdownLink(att, ctx.noteId));
    }
  }
  if (links.length > 0) {
    const textarea = ctx.wrapperRef.current?.querySelector('textarea');
    const cursorOffset = textarea?.selectionStart ?? ctx.valueRef.current.length;
    ctx.onChangeRef.current(insertAtCursor(ctx.valueRef.current, cursorOffset, links.join('\n')));
  }
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

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onFileUploadedRef = useRef(onFileUploaded);
  
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    onFileUploadedRef.current = onFileUploaded;
  });

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
        await uploadAndInsert(
          Array.from(e.dataTransfer.files),
          { noteId, wrapperRef, valueRef, onChangeRef, onFileUploadedRef },
        );
      } finally {
        setUploading(false);
      }
    },
    [noteId, wrapperRef],
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
      const imageFiles = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (imageFiles.length === 0 || noteId === undefined || noteId === '') {
        return;
      }

      e.preventDefault();
      setUploading(true);
      try {
        await uploadAndInsert(
          imageFiles,
          { noteId, wrapperRef, valueRef, onChangeRef, onFileUploadedRef },
        );
      } finally {
        setUploading(false);
      }
    },
    [noteId, wrapperRef],
  );

  return { dragging, uploading, handleDrop, handleDragOver, handleDragLeave, handlePaste };
}
