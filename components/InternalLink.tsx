'use client';

import Link from 'next/link';
import { Children } from 'react';

import { MediaAttachment } from '@/components/MediaAttachment';
import { mediaKindForFilename } from '@/lib/mediaTypes';
import { NOTES_PATH_PREFIX } from '@/lib/pathConstants';

// Anchored to the real route shape so only same-app attachment URLs become
// players — a user-authored link to an external href ending in
// `/attachments/x/download` stays a plain link (no off-origin media load).
const ATTACHMENT_HREF_RE = /^\/api\/notes\/[^/]+\/attachments\/[^/]+\/download$/;

function textOf(children: React.ReactNode): string {
  return Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('');
}

export function InternalLinkRenderer({ href, children, ...props }: React.ComponentProps<'a'>) {
  // Attachment links whose text is an audio/video filename render as an inline
  // player instead of a download link. Detection is by the filename extension
  // in the link text — the download URL itself carries no extension.
  if (typeof href === 'string' && ATTACHMENT_HREF_RE.test(href)) {
    const kind = mediaKindForFilename(textOf(children));
    if (kind !== null) {
      return <MediaAttachment kind={kind} src={href} className="my-2" />;
    }
  }

  if (typeof href === 'string' && href.startsWith(NOTES_PATH_PREFIX)) {
    return (
      <Link href={href} className="text-primary underline decoration-primary/40 hover:decoration-primary">
        {children}
      </Link>
    );
  }

  return <a href={href} {...props}>{children}</a>;
}
