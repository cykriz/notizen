'use client';
import { useTheme } from 'next-themes';
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from 'react';

import { InternalLinkRenderer } from '@/components/InternalLink';
import { MarkdownEditorToolbar } from '@/components/MarkdownEditorToolbar';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { NoteLinkPicker } from '@/components/NoteLinkPicker';
import { editorBasicSetup, staticExtensions } from '@/components/markdownEditorSetup';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useKeyboardToolbar } from '@/hooks/useKeyboardToolbar';
import { useLineTransform } from '@/hooks/useLineTransform';
import { useNoteLinkPicker } from '@/hooks/useNoteLinkPicker';
import { PREVIEW_EDIT } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { indentMore } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { openSearchPanel } from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import CodeMirror, { type ReactCodeMirrorRef, type ViewUpdate } from '@uiw/react-codemirror';

import type { Attachment } from '@/lib/fsNotes';
import type { NoteSummary, PreviewMode } from '@/lib/types';
import type { Extension } from '@codemirror/state';

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
  openSearch: () => void;
}

export const MarkdownEditor = memo(
  forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
    { value, onChange, noteId, onFileUploaded, preview = 'edit', notes },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const mounted = useClientMounted();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const cmRef = useRef<ReactCodeMirrorRef>(null);
    const viewRef = useRef<EditorView | null>(null);
    const getView = () => cmRef.current?.view ?? null;

    const isEditing = preview === PREVIEW_EDIT;

    const { dragging, uploading, fileDropExtension, handleDrop, handleDragOver, handleDragLeave } = useFileDrop({
      noteId,
      viewRef,
      onFileUploaded,
      wrapperRef,
    });
    const { increaseHeading } = useLineTransform(viewRef);
    const keyboardOffset = useKeyboardToolbar();
    const { pickerOpen, setPickerOpen, handleNoteSelect, checkLinkTrigger, noteLinkExtension } = useNoteLinkPicker({
      viewRef,
      notes,
    });

    const handleCreateEditor = useCallback((view: EditorView) => {
      viewRef.current = view;
    }, []);

    const markdownExtension = useMemo(() => markdown({ base: markdownLanguage }), []);
    const extensions = useMemo<Extension[]>(
      () => [...staticExtensions, markdownExtension, fileDropExtension, noteLinkExtension],
      [markdownExtension, fileDropExtension, noteLinkExtension],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollToLine(line: number) {
          const view = getView();
          if (view) {
            const doc = view.state.doc;
            const lineObj = doc.line(Math.min(line + 1, doc.lines));
            view.dispatch({
              selection: { anchor: lineObj.from },
              effects: EditorView.scrollIntoView(lineObj.from, { y: 'center' }),
            });
            view.focus();
            return;
          }

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
          getView()?.focus();
        },
        openSearch() {
          const v = getView();
          if (v) {
            openSearchPanel(v);
          }
        },
      }),
      [value],
    );

    const handleIndentMore = useCallback(() => {
      if (viewRef.current) {
        indentMore(viewRef.current);
      }
    }, []);

    const handleCMChange = useCallback(
      (val: string, viewUpdate: ViewUpdate) => {
        const cursor = viewUpdate.state.selection.main.head;
        if (checkLinkTrigger(val, cursor, viewUpdate.view)) {
          return;
        }

        onChange(val);
      },
      [checkLinkTrigger, onChange],
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
      >
        {isEditing ? (
          <CodeMirror
            ref={cmRef}
            value={value}
            onChange={handleCMChange}
            onCreateEditor={handleCreateEditor}
            extensions={extensions}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            basicSetup={editorBasicSetup}
            className="flex-1 min-h-0"
            placeholder="Schreibe hier deine Notiz …"
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
          <MarkdownEditorToolbar
            keyboardOffset={keyboardOffset}
            onIncreaseHeading={increaseHeading}
            onIndentMore={handleIndentMore}
          />
        )}
      </div>
    );
  }),
);
