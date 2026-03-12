'use client';

import {
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
  useMemo,
  memo,
  useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Loader2, Heading, IndentIncrease } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useKeyboardToolbar } from '@/hooks/useKeyboardToolbar';
import { useLineTransform } from '@/hooks/useLineTransform';
import { useListKeys } from '@/hooks/useListKeys';
import { useNoteLinkPicker } from '@/hooks/useNoteLinkPicker';
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
    const wrapperRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
      valueRef.current = value;
      onChangeRef.current = onChange;
    });

    const isEditing = preview === PREVIEW_EDIT;

    useLayoutEffect(() => {
      textareaRef.current?.style.setProperty('field-sizing', 'fixed');
    }, [isEditing]);

    const { dragging, uploading, handleDrop, handleDragOver, handleDragLeave, handlePaste } = useFileDrop({
      noteId,
      value,
      onChange,
      onFileUploaded,
      wrapperRef,
    });
    const { applyPendingList } = useListKeys(wrapperRef, value, onChange);
    const { increaseHeading, indentList } = useLineTransform(textareaRef, value, onChange);
    const keyboardOffset = useKeyboardToolbar();
    const { pickerOpen, setPickerOpen, handleNoteSelect, checkLinkTrigger } = useNoteLinkPicker({
      textareaRef,
      valueRef,
      onChangeRef,
      notes,
    });

    useImperativeHandle(
      ref,
      () => ({
        scrollToLine(line: number) {
          if (textareaRef.current) {
            const lines = valueRef.current.split('\n');
            let charPos = 0;
            for (let i = 0; i < line && i < lines.length; i++) {
              charPos += lines[i].length + 1;
            }
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(charPos, charPos);
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
          textareaRef.current?.focus();
        },
      }),
      [],
    );

    const pendingCursorRef = useRef<number | null>(null);

    const handleChange = useCallback(
      (v: string | undefined) => {
        const next = v ?? '';
        const pos = textareaRef.current?.selectionStart ?? next.length;
        const cursorPos = applyPendingList(next, pos);
        if (cursorPos !== false) {
          pendingCursorRef.current = cursorPos;
          return;
        }

        if (checkLinkTrigger(next, pos)) {
          return;
        }

        onChangeRef.current(next);
      },
      [applyPendingList, checkLinkTrigger],
    );

    const handleTextareaChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const scrollTop = e.target.scrollTop;
        flushSync(() => {
          handleChange(e.target.value);
        });
        if (textareaRef.current) {
          textareaRef.current.scrollTop = scrollTop;
          if (pendingCursorRef.current !== null) {
            textareaRef.current.selectionStart = pendingCursorRef.current;
            textareaRef.current.selectionEnd = pendingCursorRef.current;
            pendingCursorRef.current = null;
          }
        }
      },
      [handleChange],
    );

    const colorMode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';
    const previewComponents = useMemo(() => ({ a: InternalLinkRenderer }), []);

    return (
      <div
        ref={wrapperRef}
        data-color-mode={colorMode}
        className={cn('w-full flex-1 min-w-0 min-h-0 flex flex-col relative', { 'ring-2 ring-primary': dragging })}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
      >
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            placeholder="Schreibe hier deine Notiz …"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
            className="flex-1 min-h-0 resize-none"
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
        {isEditing && (
          <div
            className={cn('flex md:hidden items-center gap-1 border-t px-2 py-1 shrink-0 bg-background', {
              'fixed left-0 right-0 z-50 shadow-sm': keyboardOffset > 0,
            })}
            style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
          >
            <Button size="icon-xs" variant="ghost" onClick={increaseHeading}>
              <Heading />
              <span className="sr-only">Überschrift</span>
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={indentList}>
              <IndentIncrease />
              <span className="sr-only">Einrücken</span>
            </Button>
          </div>
        )}
      </div>
    );
  }),
);
