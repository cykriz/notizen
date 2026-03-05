'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  memo,
  useSyncExternalStore,
} from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useListKeys } from '@/hooks/useListKeys';
import { InternalLinkRenderer } from '@/components/InternalLink';
import { NoteLinkPicker } from '@/components/NoteLinkPicker';
import { PREVIEW_EDIT } from '@/lib/constants';
import type { Attachment } from '@/lib/fsNotes';
import type { NoteSummary, PreviewMode } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), {
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

export const MarkdownEditor = memo(
  forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
    { value, onChange, noteId, onFileUploaded, preview = 'edit', notes },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const mounted = useSyncExternalStore(
      emptySubscribe,
      () => true,
      () => false,
    );
    const [pickerOpen, setPickerOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const cursorPosRef = useRef<number>(value.length);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const notesRef = useRef(notes);

    useEffect(() => {
      valueRef.current = value;
      onChangeRef.current = onChange;
      notesRef.current = notes;
    });

    const isEditing = preview === PREVIEW_EDIT;

    const { dragging, uploading, handleDrop, handleDragOver, handleDragLeave, handlePaste } = useFileDrop({
      noteId,
      value,
      onChange,
      onFileUploaded,
      wrapperRef,
    });
    const { applyPendingList } = useListKeys(wrapperRef, value, onChange);

    useImperativeHandle(
      ref,
      () => ({
        scrollToLine(line: number) {
          const textarea = wrapperRef.current?.querySelector('textarea');
          if (textarea) {
            const lines = valueRef.current.split('\n');
            let charPos = 0;
            for (let i = 0; i < line && i < lines.length; i++) {
              charPos += lines[i].length + 1;
            }
            textarea.focus();
            textarea.setSelectionRange(charPos, charPos);
            return;
          }

          const previewEl = wrapperRef.current?.querySelector('.wmde-markdown');
          if (!previewEl) {
            return;
          }

          const headingCount = valueRef.current
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
      [],
    );

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'l' && (e.metaKey || e.ctrlKey) && notes && notes.length > 0) {
          e.preventDefault();
          const textarea = wrapperRef.current?.querySelector('textarea');
          cursorPosRef.current = textarea?.selectionStart ?? valueRef.current.length;
          setPickerOpen(true);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [notes]);

    const handleChange = useCallback(
      (v: string | undefined) => {
        const next = v ?? '';
        const textarea = wrapperRef.current?.querySelector('textarea');
        const pos = textarea?.selectionStart ?? next.length;
        if (applyPendingList(next, pos, textarea ?? null)) {
          return;
        }

        const n = notesRef.current;
        if (n && n.length > 0 && pos >= 2 && next.slice(pos - 2, pos) === '[[') {
          cursorPosRef.current = pos - 2;
          onChangeRef.current(next.slice(0, pos - 2) + next.slice(pos));
          setPickerOpen(true);
          return;
        }

        onChangeRef.current(next);
      },
      [applyPendingList],
    );

    const handleTextareaChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        handleChange(e.target.value);
      },
      [handleChange],
    );

    const handleNoteSelect = useCallback((note: NoteSummary) => {
      const link = `[${note.title}](/notes/${note.id})`;
      const pos = cursorPosRef.current;
      onChangeRef.current(`${valueRef.current.slice(0, pos)}${link}${valueRef.current.slice(pos)}`);
    }, []);

    const colorMode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';
    const previewComponents = useMemo(() => ({ a: InternalLinkRenderer }), []);

    return (
      <div
        ref={wrapperRef}
        data-color-mode={colorMode}
        className={cn('w-full flex-1 min-h-0 relative', { 'ring-2 ring-primary': dragging })}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
      >
        {isEditing ? (
          <Textarea
            value={value}
            onChange={handleTextareaChange}
            placeholder="Schreibe hier deine Notiz …"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <MarkdownPreview source={value} components={previewComponents} />
          </div>
        )}
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
  }),
);
