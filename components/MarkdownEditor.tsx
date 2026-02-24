'use client';

import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileDrop } from '@/hooks/useFileDrop';
import { InternalLinkRenderer } from '@/components/InternalLink';
import { NoteLinkPicker } from '@/components/NoteLinkPicker';
import type { Attachment } from '@/lib/fsNotes';
import type { NoteSummary, PreviewMode } from '@/lib/types';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  noteId?: string;
  onFileUploaded?: (attachment: Attachment) => void;
  preview?: PreviewMode;
  notes?: NoteSummary[];
}

export interface MarkdownEditorHandle {
  scrollToLine: (line: number) => void;
  focus: () => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  { value, onChange, noteId, onFileUploaded, preview = 'edit', notes },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cursorPosRef = useRef<number>(value.length);

  const { dragging, uploading, handleDrop, handleDragOver, handleDragLeave } = useFileDrop({
    noteId,
    value,
    onChange,
    onFileUploaded,
    wrapperRef,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(line: number) {
        const previewEl = wrapperRef.current?.querySelector('.wmde-markdown');
        if (!previewEl) {
          return;
        }

        const headingCount = value
          .split('\n')
          .slice(0, line)
          .filter((l) => /^#{1,6}\s+/.test(l)).length;
        const headings = previewEl.querySelectorAll('h1,h2,h3,h4,h5,h6');
        if (headingCount < headings.length) {
          headings[headingCount].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      focus() {
        wrapperRef.current?.querySelector('textarea')?.focus();
      },
    }),
    [value],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true); 
    });
    return () => {
      cancelAnimationFrame(id); 
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' && (e.metaKey || e.ctrlKey) && notes && notes.length > 0) {
        e.preventDefault();
        const textarea = wrapperRef.current?.querySelector('textarea');
        cursorPosRef.current = textarea?.selectionStart ?? value.length;
        setPickerOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown); 
    };
  }, [notes, value.length]);

  const handleChange = useCallback(
    (v: string | undefined) => {
      const next = v ?? '';
      const textarea = wrapperRef.current?.querySelector('textarea');
      const pos = textarea?.selectionStart ?? next.length;
      if (notes && notes.length > 0 && pos >= 2 && next.slice(pos - 2, pos) === '[[') {
        cursorPosRef.current = pos - 2;
        onChange(next.slice(0, pos - 2) + next.slice(pos));
        setPickerOpen(true);
        return;
      }

      onChange(next);
    },
    [notes, onChange],
  );

  const handleNoteSelect = useCallback(
    (note: NoteSummary) => {
      const link = `[${note.title}](/notes/${note.id})`;
      const pos = cursorPosRef.current;
      const before = value.slice(0, pos);
      const after = value.slice(pos);
      onChange(`${before}${link}${after}`);
    },
    [value, onChange],
  );

  const colorMode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <div
      ref={wrapperRef}
      data-color-mode={colorMode}
      className={cn('w-full flex-1 min-h-0 relative', { 'ring-2 ring-primary': dragging })}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <MDEditor
        value={value}
        onChange={handleChange}
        height="100%"
        preview={preview}
        hideToolbar
        textareaProps={{ placeholder: 'Schreibe hier deine Notiz …' }}
        previewOptions={{ components: { a: InternalLinkRenderer } }}
      />
      {dragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/80 pointer-events-none z-10">
          <p className="text-sm font-medium text-accent-foreground">Loslassen zum Hochladen</p>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 pointer-events-none z-10">
          <p className="text-sm font-medium text-muted-foreground">Wird hochgeladen…</p>
        </div>
      )}
      {notes && (
        <NoteLinkPicker notes={notes} open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handleNoteSelect} />
      )}
    </div>
  );
});
