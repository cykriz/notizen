'use client';

import { useCallback, useRef, useState } from 'react';
import { formatUploadLabel, uploadFiles, type UploadProgress } from '@/lib/attachmentUpload';
import { UPLOAD_FAILED_MESSAGE } from '@/lib/constants';
import type { Attachment } from '@/lib/fsNotes';

interface UseAttachmentUploadParams {
  noteId: string;
  onUploaded: (attachment: Attachment) => void;
  onInsertLinks: (links: string[]) => void;
}

// Encapsulates the note-attachment upload flow (hidden file input + progress),
// keeping it out of the NoteActionsMenu JSX.
export function useAttachmentUpload({ noteId, onUploaded, onInsertLinks }: UseAttachmentUploadParams) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files === null || files.length === 0) {
        return;
      }

      const list = Array.from(files);
      setProgress({ fileIndex: 1, fileCount: list.length, fileName: list[0].name, percent: 0 });
      setError(null);
      try {
        const { links, failed } = await uploadFiles(list, noteId, { onUploaded, onProgress: setProgress });
        onInsertLinks(links);
        if (failed > 0) {
          setError(UPLOAD_FAILED_MESSAGE);
        }
      } catch {
        setError(UPLOAD_FAILED_MESSAGE);
      } finally {
        setProgress(null);
        // Reset so selecting the same file again re-triggers onChange.
        e.target.value = '';
      }
    },
    [noteId, onUploaded, onInsertLinks],
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    inputRef,
    progress,
    error,
    uploading: progress !== null,
    label: progress ? formatUploadLabel(progress) : null,
    openPicker,
    handleChange,
  };
}
