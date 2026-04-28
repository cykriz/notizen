import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getNote, type Note } from '@/lib/fsNotes';
import { getShare } from '@/lib/fsShares';
import { userRootFor } from '@/lib/fsHelpers';
import { rewriteAttachmentUrlsForShare } from '@/lib/shareContent';
import { SharedNoteView } from './SharedNoteView';

interface PageProps {
  params: Promise<{ token: string }>;
}

// Bypass the Full Route Cache so revoke/expiry/preset changes show up on the
// next request without an explicit revalidatePath. The proxy already sets
// Cache-Control: private, max-age=0, must-revalidate for /share/, so this is
// purely about Next's own RSC caching.
export const dynamic = 'force-dynamic';

// PWA / icon metadata is suppressed in app/share/layout.tsx; here we only
// add per-note title and `noindex` for crawlers.
const BASE_METADATA: Metadata = {
  robots: { index: false, follow: false },
};

const loadSharedNote = cache(async (token: string): Promise<Note | null> => {
  const share = await getShare(token);
  if (!share) {
    return null;
  }

  return await getNote(share.noteId, userRootFor(share.username));
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const note = await loadSharedNote(token);
  return { ...BASE_METADATA, title: note?.title ?? 'Link nicht verfügbar' };
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const note = await loadSharedNote(token);
  if (!note) {
    notFound();
  }

  const content = rewriteAttachmentUrlsForShare(note.content, note.id, token);

  return <SharedNoteView title={note.title} content={content} />;
}
