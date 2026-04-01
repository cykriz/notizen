import { useState, useCallback, useRef, useEffect, useMemo, type RefObject } from 'react';
import { EditorView } from '@codemirror/view';
import type { Attachment } from '@/lib/fsNotes';

function buildMarkdownLink(att: Attachment, noteId: string): string {
  const url = `/api/notes/${noteId}/attachments/${att.id}/download`;
  if (att.mimeType.startsWith('image/')) {
    return `![${att.originalName}](${url})`;
  }

  return `[${att.originalName}](${url})`;
}

async function uploadFiles(
  files: File[],
  noteId: string,
  onFileUploadedRef: React.RefObject<((att: Attachment) => void) | undefined>,
): Promise<string[]> {
  const links: string[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/notes/${noteId}/attachments`, { method: 'POST', body: form });
    if (res.ok) {
      const att = (await res.json()) as Attachment;
      onFileUploadedRef.current?.(att);
      links.push(buildMarkdownLink(att, noteId));
    }
  }
  return links;
}

function insertLinks(view: EditorView, links: string[]) {
  if (links.length === 0) {
    return;
  }

  const pos = view.state.selection.main.head;
  const sep = pos > 0 && view.state.doc.sliceString(pos - 1, pos) !== '\n' ? '\n' : '';
  const insertion = `${sep}${links.join('\n')}\n`;
  view.dispatch({ changes: { from: pos, insert: insertion } });
}

interface UseFileDropOptions {
  noteId?: string;
  viewRef: RefObject<EditorView | null>;
  onFileUploaded?: (attachment: Attachment) => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export function useFileDrop({ noteId, viewRef, onFileUploaded, wrapperRef }: UseFileDropOptions) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const noteIdRef = useRef(noteId);
  const onFileUploadedRef = useRef(onFileUploaded);

  useEffect(() => {
    noteIdRef.current = noteId;
    onFileUploadedRef.current = onFileUploaded;
  }, [noteId, onFileUploaded]);

  // CM6 extension that intercepts image paste events before the editor processes them
  const fileDropExtension = useMemo(
    () =>
      EditorView.domEventHandlers({
        paste(event, view) {
          const imageFiles = Array.from(event.clipboardData?.items ?? [])
            .filter((i) => i.type.startsWith('image/'))
            .map((i) => i.getAsFile())
            .filter((f): f is File => f !== null);
          if (imageFiles.length === 0 || noteIdRef.current === undefined) {
            return false;
          }

          event.preventDefault();
          setUploading(true);
          void uploadFiles(imageFiles, noteIdRef.current, onFileUploadedRef)
            .then((links) => {
              insertLinks(view, links);
            })
            .catch(() => {
              // Netzwerkfehler — Einfügen ignoriert
            })
            .finally(() => {
              setUploading(false);
            });
          return true;
        },
      }),
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const id = noteIdRef.current;
      if (id === undefined || e.dataTransfer.files.length === 0) {
        return;
      }

      const view = viewRef.current;
      if (!view) {
        return;
      }

      setUploading(true);
      try {
        const links = await uploadFiles(Array.from(e.dataTransfer.files), id, onFileUploadedRef);
        insertLinks(view, links);
      } catch {
        // Netzwerkfehler — Upload ignoriert
      } finally {
        setUploading(false);
      }
    },
    [viewRef],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (noteIdRef.current !== undefined) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node)) {
        setDragging(false);
      }
    },
    [wrapperRef],
  );

  return { dragging, uploading, fileDropExtension, handleDrop, handleDragOver, handleDragLeave };
}
