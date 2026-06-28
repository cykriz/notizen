'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatUploadLabel, uploadFiles, type UploadProgress } from '@/lib/attachmentUpload';
import type { Attachment } from '@/lib/fsNotes';

interface AttachmentUploadButtonProps {
  noteId: string;
  onUploaded: (attachment: Attachment) => void;
  onInsertLinks: (links: string[]) => void;
}

export function AttachmentUploadButton({ noteId, onUploaded, onInsertLinks }: AttachmentUploadButtonProps) {
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
          setError('Upload fehlgeschlagen');
        }
      } catch {
        setError('Upload fehlgeschlagen');
      } finally {
        setProgress(null);
        // Reset so selecting the same file again re-triggers onChange.
        e.target.value = '';
      }
    },
    [noteId, onUploaded, onInsertLinks],
  );

  const uploading = progress !== null;

  return (
    <span className="relative inline-flex">
      <Button
        onClick={() => {
          inputRef.current?.click();
        }}
        size="icon-xs"
        variant="ghost"
        disabled={uploading}
        aria-label={progress ? formatUploadLabel(progress) : 'Datei anhängen'}
        title={error ?? 'Datei anhängen'}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
      </Button>
      {/* Rendered outside the Button so it is not faded by disabled:opacity-50. */}
      {progress && (
        <Progress
          value={progress.percent}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleChange(e);
        }}
      />
    </span>
  );
}
