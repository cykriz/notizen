'use client';

import { cn } from '@/lib/utils';
import type { MediaKind } from '@/lib/mediaTypes';

interface MediaAttachmentProps {
  kind: MediaKind;
  src: string;
  className?: string;
}

export function MediaAttachment({ kind, src, className }: MediaAttachmentProps) {
  if (kind === 'audio') {
    return (
      <audio controls preload="metadata" src={src} aria-label="Audiowiedergabe" className={cn('w-full', className)} />
    );
  }

  return (
    <video
      controls
      preload="metadata"
      src={src}
      aria-label="Videowiedergabe"
      className={cn('max-w-full rounded-md', className)}
    />
  );
}
