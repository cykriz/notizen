'use client';
import { useTheme } from 'next-themes';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import { usePreviewCheckbox } from '@/hooks/usePreviewCheckbox';

import { MarkdownEditorToolbar } from '@/components/MarkdownEditorToolbar';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { NoteLinkPicker } from '@/components/NoteLinkPicker';
import { PreviewCheckboxContext } from '@/components/PreviewCheckbox';
import { editorBasicSetup, staticExtensions } from '@/components/markdownEditorSetup';
import { useClientMounted } from '@/hooks/useClientMounted';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useLineTransform } from '@/hooks/useLineTransform';
import { useNoteLinkPicker } from '@/hooks/useNoteLinkPicker';
import { PREVIEW_EDIT } from '@/lib/constants';
import { getSourceOffsetFromClick } from '@/lib/previewClickToOffset';
import { remarkLooseListGaps } from '@/lib/remarkLooseListGaps';
import { remarkSourceOffset } from '@/lib/remarkSourceOffset';
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
  onSwitchToEdit?: () => void;
}

export interface MarkdownEditorHandle {
  scrollToLine: (line: number) => void;
  focus: () => void;
  openSearch: () => void;
  getScrollContainer: () => HTMLElement | null;
}

export const MarkdownEditor = memo(
  forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
    { value, onChange, noteId, onFileUploaded, preview = 'edit', notes, onSwitchToEdit },
    ref,
  ) {
    const { resolvedTheme } = useTheme();
    const mounted = useClientMounted();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const cmRef = useRef<ReactCodeMirrorRef>(null);
    const viewRef = useRef<EditorView | null>(null);
    const getView = () => cmRef.current?.view ?? null;

    const isEditing = preview === PREVIEW_EDIT;
    const pendingCursorPosRef = useRef<number | null>(null);
    const valueRef = useRef(value);
    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    const { dragging, uploading, fileDropExtension, handleDrop, handleDragOver, handleDragLeave } = useFileDrop({
      noteId,
      viewRef,
      onFileUploaded,
      wrapperRef,
    });
    const { increaseHeading } = useLineTransform(viewRef);
    const { pickerOpen, setPickerOpen, handleNoteSelect, checkLinkTrigger, noteLinkExtension } = useNoteLinkPicker({
      viewRef,
      notes,
    });

    // Called once when CodeMirror mounts; stores the editor ref and places cursor
    const handleCreateEditor = useCallback((view: EditorView) => {
      viewRef.current = view;
      const pending = pendingCursorPosRef.current;
      pendingCursorPosRef.current = null;

      if (pending !== null && pending >= 0 && pending <= view.state.doc.length) {
        const line = view.state.doc.lineAt(pending);
        view.dispatch({
          selection: { anchor: line.to },
          effects: EditorView.scrollIntoView(line.to, { y: 'center' }),
        });
      } else {
        const end = view.state.doc.length;
        view.dispatch({ selection: { anchor: end }, scrollIntoView: true });
      }
    }, []);

    const handlePreviewClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (target.closest('a') || target.closest('[data-slot="checkbox"]')) {
          return;
        }

        const offset: number | null = getSourceOffsetFromClick(target);
        if (offset === null) {
          return;
        }

        pendingCursorPosRef.current = offset;
        onSwitchToEdit?.();
      },
      [onSwitchToEdit],
    );

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
          getView()?.focus();
        },
        openSearch() {
          const v = getView();
          if (v) {
            openSearchPanel(v);
          }
        },
        getScrollContainer() {
          return getView()?.scrollDOM ?? previewScrollRef.current;
        },
      }),
      [],
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

    const colorMode = (mounted ? resolvedTheme : undefined) ?? 'dark';
    const { checkboxCtx, previewComponents } = usePreviewCheckbox(value, onChange);
    const previewRemarkPlugins = useMemo(() => [remarkSourceOffset, remarkLooseListGaps], []);

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
          <PreviewCheckboxContext.Provider value={checkboxCtx}>
            <div ref={previewScrollRef} className="h-full overflow-y-auto overscroll-contain cursor-text" onClick={handlePreviewClick}>
              <MarkdownPreview source={value} components={previewComponents} remarkPlugins={previewRemarkPlugins} />
            </div>
          </PreviewCheckboxContext.Provider>
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
          <MarkdownEditorToolbar onIncreaseHeading={increaseHeading} onIndentMore={handleIndentMore} />
        )}
      </div>
    );
  }),
);
