'use client';

import { memo, useCallback, useState } from 'react';
import { Copy, Check, Eye, Pencil, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULT_NOTE_TITLE, PREVIEW_EDIT } from '@/lib/constants';
import type { PreviewMode } from '@/lib/types';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import type { Attachment } from '@/lib/fsNotes';
import { TagInput } from './TagInput';
import { ReadAloudControls } from '@/components/ReadAloudControls';
import { NoteActionsMenu } from './NoteActionsMenu';

const COPY_KEY_NOTE_MD = 'note-md';

interface NoteHeaderProps {
  noteId: string;
  title: string;
  onTitleChange: (title: string) => void;
  preview: PreviewMode;
  onTogglePreview: () => void;
  getContent: () => string;
  outlineVisible: boolean;
  onToggleOutline: () => void;
  tags: string[];
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
  onFileUploaded: (attachment: Attachment) => void;
  onInsertLinks: (links: string[]) => void;
}

export const NoteHeader = memo(function NoteHeader({
  noteId,
  title,
  onTitleChange,
  preview,
  onTogglePreview,
  getContent,
  outlineVisible,
  onToggleOutline,
  tags,
  allTags,
  onTagsChange,
  onFileUploaded,
  onInsertLinks,
}: NoteHeaderProps) {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const { copiedKey, copy } = useCopyToClipboard();
  const isCopied = copiedKey === COPY_KEY_NOTE_MD;

  const handleCopy = useCallback(() => {
    void copy(COPY_KEY_NOTE_MD, getContent());
  }, [copy, getContent]);

  return (
    <Card className="shrink-0 gap-0 py-0 shadow-panel z-10 mx-2 mt-2">
      <CardContent className="note-section-padding relative flex items-center gap-2">
        <Input
          id="note-title"
          name="note-title"
          value={title}
          onChange={(e) => {
            onTitleChange(e.target.value);
          }}
          onBlur={() => {
            // A blank title is not sent (buildNoteSavePayload omits it), so the field
            // would keep showing empty while the server still holds the old title.
            // Normalising on blur keeps the two in agreement.
            if (title.trim() === '') {
              onTitleChange(DEFAULT_NOTE_TITLE);
            }
          }}
          placeholder="Notiz-Titel…"
          rounded={false}
          className="flex-1 text-lg p-0 font-semibold h-auto border-none shadow-none focus-visible:ring-0 placeholder:text-xl md:placeholder:text-2xl bg-transparent"
        />

        <TagInput tags={tags} allTags={allTags} onChange={onTagsChange} compact className="hidden md:flex min-w-0" />

        {tagsExpanded && (
          <div className="absolute inset-y-0 left-0 right-12 z-10 flex items-center rounded-xl bg-card note-section-padding md:hidden">
            <TagInput
              tags={tags}
              allTags={allTags}
              onChange={onTagsChange}
              onCollapse={() => {
                setTagsExpanded(false);
              }}
              compact
              className="flex-1 min-w-0"
            />
          </div>
        )}

        <div className="relative z-20 flex shrink-0 items-center gap-2 md:gap-1">
          <Button
            onClick={onToggleOutline}
            size="icon-xs"
            variant="ghost"
            className={cn('hidden md:inline-flex', { 'bg-accent': outlineVisible })}
          >
            <List />
          </Button>
          <Button onClick={onTogglePreview} size="icon-xs" variant="ghost">
            {preview === PREVIEW_EDIT ? <Eye /> : <Pencil />}
          </Button>
          <ReadAloudControls getContent={getContent} title={title} />
          <Button
            onClick={handleCopy}
            size="icon-xs"
            variant="ghost"
            aria-label="Markdown kopieren"
            title="Markdown kopieren"
          >
            {isCopied ? <Check /> : <Copy />}
          </Button>
          <NoteActionsMenu
            noteId={noteId}
            onFileUploaded={onFileUploaded}
            onInsertLinks={onInsertLinks}
            onExpandTags={() => {
              setTagsExpanded(true);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
});
