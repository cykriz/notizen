import { useState, useCallback, useRef, useEffect, useMemo, type RefObject } from 'react';
import { EditorView } from '@codemirror/view';
import type { Attachment } from '@/lib/fsNotes';
import { appendLinks, uploadFiles } from '@/lib/attachmentUpload';

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
  // Current editor content + onChange — used to append links when no CodeMirror
  // view exists (i.e. in preview mode, where uploads must still work).
  valueRef?: RefObject<string>;
  onChange?: (value: string) => void;
}

export function useFileDrop({ noteId, viewRef, onFileUploaded, wrapperRef, valueRef, onChange }: UseFileDropOptions) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const noteIdRef = useRef(noteId);
  const onFileUploadedRef = useRef(onFileUploaded);

  useEffect(() => {
    noteIdRef.current = noteId;
    onFileUploadedRef.current = onFileUploaded;
  }, [noteId, onFileUploaded]);

  const notifyUploaded = useCallback((att: Attachment) => {
    onFileUploadedRef.current?.(att);
  }, []);

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
          void uploadFiles(imageFiles, noteIdRef.current, notifyUploaded)
            .then(({ links }) => {
              insertLinks(view, links);
            })
            .catch(() => {
              // Network error — insertion ignored
            })
            .finally(() => {
              setUploading(false);
            });
          return true;
        },
      }),
    [notifyUploaded],
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

      setUploading(true);
      try {
        const { links } = await uploadFiles(Array.from(e.dataTransfer.files), id, notifyUploaded);
        const view = viewRef.current;
        if (view) {
          // Edit mode: insert at the cursor.
          insertLinks(view, links);
        } else if (onChange && valueRef) {
          // Preview mode: no editor view — append to the end of the content.
          onChange(appendLinks(valueRef.current, links));
        }
      } catch {
        // Netzwerkfehler — Upload ignoriert
      } finally {
        setUploading(false);
      }
    },
    [viewRef, notifyUploaded, onChange, valueRef],
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
