'use client';

// Route-level error boundary for the (app) subtree. Renders INSIDE the root
// layout (Providers, fonts, body styles available), so it can use shadcn/ui
// and semantic Tailwind tokens. Sibling app/global-error.tsx catches errors
// the root layout itself throws — that one must be import-free and render
// its own <html><body>, so the two cannot collapse into one file.
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  ERROR_GENERIC_BODY,
  ERROR_GENERIC_TITLE,
  ERROR_OFFLINE_BODY,
  ERROR_OFFLINE_TITLE,
  ERROR_RETRY_LABEL,
} from '@/lib/constants';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  // ChunkLoadError fires when the client can't fetch a JS chunk — almost always
  // because we're offline (or the cached HTML refers to chunks not yet in
  // the static cache). Don't gate on isOnline: useOnlineStatus defaults to true until
  // its health check resolves, which would briefly flash the wrong message.
  const isChunkError = error.name === 'ChunkLoadError' || error.message.includes('Failed to fetch');

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-4">
        <h2 className="text-lg font-semibold">
          {isChunkError ? ERROR_OFFLINE_TITLE : ERROR_GENERIC_TITLE}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isChunkError ? ERROR_OFFLINE_BODY : ERROR_GENERIC_BODY}
        </p>
        <Button variant="outline" onClick={reset}>
          {ERROR_RETRY_LABEL}
        </Button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional: a full-page <a> navigation discards the broken client-side router state that triggered this boundary; next/link would attempt a client transition and re-hit the same failed chunk load */}
        <a href="/notes" className="block text-sm text-muted-foreground underline">
          Zu den Notizen
        </a>
      </div>
    </div>
  );
}
