'use client';

import { useTheme } from 'next-themes';
import { useMemo, useRef } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview/nohighlight';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NoteOutline, extractHeadings } from '@/components/NoteOutline';
import { useClientMounted } from '@/hooks/useClientMounted';
import { remarkLooseListGaps } from '@/lib/remarkLooseListGaps';

interface SharedNoteViewProps {
  title: string;
  content: string;
}

// @uiw/react-markdown-preview overrides react-markdown's defaultUrlTransform
// with a pass-through, so javascript:/data:/vbscript: URLs in markdown links
// would otherwise reach the DOM. Mirror react-markdown's allowlist here
// (relative URLs, http/https/mailto/tel/xmpp/irc/ircs/sms protocols allowed).
const SAFE_PROTOCOL_RE = /^(https?|mailto|tel|xmpp|irc|ircs|sms)$/i;

function safeUrlTransform(url: string): string {
  const colon = url.indexOf(':');
  if (colon === -1) {
    return url;
  }

  const slash = url.indexOf('/');
  const question = url.indexOf('?');
  const hash = url.indexOf('#');
  if (
    (slash !== -1 && colon > slash) ||
    (question !== -1 && colon > question) ||
    (hash !== -1 && colon > hash)
  ) {
    return url;
  }

  return SAFE_PROTOCOL_RE.test(url.slice(0, colon)) ? url : '';
}

export function SharedNoteView({ title, content }: SharedNoteViewProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useClientMounted();
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const colorMode = (mounted ? resolvedTheme : undefined) ?? 'light';

  const previewRemarkPlugins = useMemo(() => [remarkLooseListGaps], []);

  const headings = useMemo(() => extractHeadings(content), [content]);

  const handleHeadingClick = (_line: number, index: number) => {
    const previewEl = previewScrollRef.current?.querySelector('.wmde-markdown');
    if (!previewEl) {
      return;
    }

    const headingEls = previewEl.querySelectorAll('h1,h2,h3,h4,h5,h6');
    if (index < headingEls.length) {
      headingEls[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col h-dvh">
      <Card className="shrink-0 gap-0 py-0 shadow-panel z-10 mx-2 mt-2">
        <CardContent className="note-section-padding flex items-center gap-3">
          <h1 className="flex-1 min-w-0 truncate text-xl md:text-2xl font-semibold">
            {title}
          </h1>
          <Badge variant="secondary" className="shrink-0">
            Nur-Lese-Ansicht
          </Badge>
        </CardContent>
      </Card>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {headings.length > 0 && (
          <aside className="hidden md:flex flex-col w-56 shrink-0">
            <NoteOutline
              headings={headings}
              onHeadingClick={handleHeadingClick}
              className="flex-1 min-h-0"
            />
          </aside>
        )}
        <div
          data-color-mode={colorMode}
          className="w-full flex-1 min-w-0 min-h-0 flex flex-col"
        >
          <div ref={previewScrollRef} className="h-full overflow-y-auto overscroll-contain">
            {/* XSS gate: @uiw/react-markdown-preview overrides
                react-markdown's URL allowlist with a pass-through, so we
                must pass our own urlTransform to block javascript:/data:/etc.
                Raw <script>/<iframe>/etc. are filtered by allowElement
                (alphanumeric tag check) inside the preview component.
                Covered by share-note.spec.ts "raw HTML … is escaped". */}
            <MarkdownPreview
              source={content}
              remarkPlugins={previewRemarkPlugins}
              urlTransform={safeUrlTransform}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
