'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFiles } from '@/lib/attachmentUpload';
import type { Attachment } from '@/lib/fsNotes';

interface AttachmentUploadButtonProps {
  noteId: string;
  onUploaded: (attachment: Attachment) => void;
  onInsertLinks: (links: string[]) => void;
}

export function AttachmentUploadButton({ noteId, onUploaded, onInsertLinks }: AttachmentUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files === null || files.length === 0) {
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const { links, failed } = await uploadFiles(Array.from(files), noteId, onUploaded);
        onInsertLinks(links);
        if (failed > 0) {
          setError('Upload fehlgeschlagen');
        }
      } catch {
        setError('Upload fehlgeschlagen');
      } finally {
        setUploading(false);
        // Reset so selecting the same file again re-triggers onChange.
        e.target.value = '';
      }
    },
    [noteId, onUploaded, onInsertLinks],
  );

  return (
    <>
      <Button
        onClick={() => {
          inputRef.current?.click();
        }}
        size="icon-xs"
        variant="ghost"
        disabled={uploading}
        aria-label="Datei anhängen"
        title={error ?? 'Datei anhängen'}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleChange(e);
        }}
      />
    </>
  );
}
