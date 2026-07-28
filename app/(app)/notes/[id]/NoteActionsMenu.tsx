'use client';

import { useCallback, useState } from 'react';
import { ChevronLeft, Loader2, MoreHorizontal, Paperclip, Share, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import type { Attachment } from '@/lib/fsNotes';
import { useAttachmentUpload } from '@/hooks/useAttachmentUpload';
import { ShareMenuView } from './ShareMenuView';

type MenuView = 'menu' | 'share';

interface NoteActionsMenuProps {
  noteId: string;
  onFileUploaded: (attachment: Attachment) => void;
  onInsertLinks: (links: string[]) => void;
  // Mobile-only: reveals the tag input overlay in the header.
  onExpandTags: () => void;
}

const ROW_CLASS = 'w-full justify-start gap-2 font-normal';

export function NoteActionsMenu({ noteId, onFileUploaded, onInsertLinks, onExpandTags }: NoteActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>('menu');
  const { inputRef, progress, error, uploading, label, openPicker, handleChange } = useAttachmentUpload({
    noteId,
    onUploaded: onFileUploaded,
    onInsertLinks,
  });

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setView('menu');
    }
  }, []);

  const handleTags = useCallback(() => {
    onExpandTags();
    setOpen(false);
  }, [onExpandTags]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Weitere Aktionen"
          title="Weitere Aktionen"
          className={cn({ 'bg-accent': open || uploading })}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={-3} className="w-72">
        <PopoverArrow className="-translate-y-1/2" />

        {view === 'menu' ? (
          <div className="flex flex-col gap-1">
            <Button variant="ghost" className={ROW_CLASS} onClick={openPicker} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
              Datei anhängen
            </Button>
            {progress && (
              <div className="px-2 pb-1">
                <p className="mb-1 truncate text-xs text-muted-foreground">{label}</p>
                <Progress value={progress.percent} className="h-1" />
              </div>
            )}
            {error !== null && !uploading && <p className="px-2 text-xs text-destructive">{error}</p>}

            <Button
              variant="ghost"
              className={ROW_CLASS}
              onClick={() => {
                setView('share');
              }}
            >
              <Share />
              Teilen
            </Button>

            <Button variant="ghost" className={cn(ROW_CLASS, 'md:hidden')} onClick={handleTags}>
              <Tag />
              Tags
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-1 w-fit justify-start gap-1 px-1 font-normal text-muted-foreground"
              onClick={() => {
                setView('menu');
              }}
            >
              <ChevronLeft />
              Zurück
            </Button>
            <ShareMenuView noteId={noteId} />
          </div>
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
      </PopoverContent>
    </Popover>
  );
}
