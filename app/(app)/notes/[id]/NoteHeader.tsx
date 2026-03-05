'use client';

import { memo } from 'react';
import { Save, Loader2, Eye, Pencil, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PREVIEW_EDIT } from '@/lib/constants';
import type { PreviewMode } from '@/lib/types';
import { TagInput } from './TagInput';

interface NoteHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  preview: PreviewMode;
  onTogglePreview: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  isDirty: boolean;
  onSavedReset: () => void;
  outlineVisible: boolean;
  onToggleOutline: () => void;
  tags: string[];
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const NoteHeader = memo(function NoteHeader({
  title,
  onTitleChange,
  preview,
  onTogglePreview,
  onSave,
  saving,
  saved,
  isDirty,
  onSavedReset,
  outlineVisible,
  onToggleOutline,
  tags,
  allTags,
  onTagsChange,
}: NoteHeaderProps) {
  return (
    <Card className="shrink-0 gap-0 py-0 shadow-panel z-10 mx-2 mt-2">
      <CardContent className="note-section-padding flex items-center gap-3">
        <Input
          id="note-title"
          name="note-title"
          value={title}
          onChange={(e) => {
            onTitleChange(e.target.value);
            onSavedReset();
          }}
          placeholder="Notiz-Titel…"
          rounded={false}
          className="flex-1 text-lg p-0 font-semibold h-auto border-none shadow-none focus-visible:ring-0 placeholder:text-xl md:placeholder:text-2xl bg-transparent"
        />
        <TagInput
          tags={tags}
          allTags={allTags}
          onChange={onTagsChange}
          compact
          className="hidden md:flex flex-1 min-w-0"
        />
        <div className="flex shrink-0 items-center gap-2 md:gap-1">
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
          <Button onClick={onSave} disabled={saving || (!isDirty && !saved)} size="icon-xs" variant="ghost">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
          </Button>
        </div>
      </CardContent>
      <div className="md:hidden border-t border-border">
        <TagInput tags={tags} allTags={allTags} onChange={onTagsChange} />
      </div>
    </Card>
  );
});
