'use client';

import { useState } from 'react';
import { Download, Trash2, Paperclip, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { MediaAttachment } from '@/components/MediaAttachment';
import { cn } from '@/lib/utils';
import { mediaKindForFilename } from '@/lib/mediaTypes';
import { attachmentDownloadPath } from '@/lib/attachmentUpload';
import type { Attachment } from '@/lib/fsNotes';

interface AttachmentListProps {
  noteId: string;
  attachments: Attachment[];
  onDeleted?: (attId: string) => void;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ noteId, attachments, onDeleted, className }: AttachmentListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  // Both failure modes read the same to the user, and the message lives once:
  // a rejecting response used to be swallowed entirely, leaving the attachment
  // listed with no explanation.
  const handleDelete = async (attId: string) => {
    setDeleting(attId);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/attachments/${attId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onDeleted?.(attId);
        return;
      }
    } catch {
      // Network error — same message as a rejecting response.
    } finally {
      setDeleting(null);
    }

    setError('Löschen fehlgeschlagen');
  };

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Keine Anhänge</p>;
  }

  return (
    <Card className={cn('py-0', className)}>
      <CardContent className="note-section-padding flex flex-col">
        {error !== null && <p className="text-sm text-destructive py-1">{error}</p>}
        {attachments.map((att, i) => {
          const mediaKind = mediaKindForFilename(att.originalName);
          const downloadUrl = attachmentDownloadPath(noteId, att.id);
          return (
            <div key={att.id} className={cn('flex items-center gap-3 py-2', { 'border-t border-border': i > 0 })}>
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.originalName}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge variant="secondary">{att.mimeType}</Badge>
                  <span className="text-xs text-muted-foreground">{formatSize(att.size)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {mediaKind !== null && (
                  <Popover
                    open={openPlayer === att.id}
                    onOpenChange={(open) => {
                      setOpenPlayer(open ? att.id : null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon-xs" aria-label="Abspielen">
                        <Play />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{att.originalName}</p>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Schließen"
                          onClick={() => {
                            setOpenPlayer(null);
                          }}
                        >
                          <X />
                        </Button>
                      </div>
                      <MediaAttachment kind={mediaKind} src={downloadUrl} />
                    </PopoverContent>
                  </Popover>
                )}
                <Button variant="ghost" size="icon-xs" asChild>
                  <a href={downloadUrl} download={att.originalName} aria-label="Herunterladen">
                    <Download />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Anhang löschen"
                  onClick={() => {
                    void handleDelete(att.id);
                  }}
                  disabled={deleting === att.id}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
