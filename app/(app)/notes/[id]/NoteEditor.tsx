'use client';

import { AttachmentList } from '@/components/AttachmentList';
import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/MarkdownEditor';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useAutoShowOutline } from '@/hooks/useAutoShowOutline';
import { useDraft } from '@/hooks/useDraft';
import { useFocusOnEditMode } from '@/hooks/useFocusOnEditMode';
import { useNoteInitialState } from '@/hooks/useNoteInitialState';
import { useNoteKeyboardShortcuts } from '@/hooks/useNoteKeyboardShortcuts';
import { PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
import type { Attachment, Note } from '@/lib/fsNotes';
import type { NoteSummary, PreviewMode } from '@/lib/types';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteNoteDialog } from '../../DeleteNoteDialog';
import { useData } from '../../DataProvider';
import { NoteHeader } from './NoteHeader';
import { SaveIndicator } from './SaveIndicator';
import { NoteOutline, extractHeadings } from '@/components/NoteOutline';

interface NoteEditorProps {
  note: Note;
  allTags: string[];
  notes: NoteSummary[];
}

export function NoteEditor({ note, allTags, notes }: NoteEditorProps) {
  const { updateNote } = useData();
  const initial = useNoteInitialState(note);
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [attachments, setAttachments] = useState<Attachment[]>(note.attachments);
  const [preview, setPreview] = useState<PreviewMode>(initial.preview);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [outlineVisible, setOutlineVisible] = useState(initial.outlineVisible);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deferredContent = useDeferredValue(content);
  const headings = useMemo(() => extractHeadings(deferredContent), [deferredContent]);
  const nonImageAttachments = useMemo(() => attachments.filter((a) => !a.mimeType.startsWith('image/')), [attachments]);

  // Avoid passing live `content` to memoized NoteHeader — it would re-render on every keystroke.
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  const getContent = useCallback(() => contentRef.current, []);

  const saveContent = useCallback(
    async (id: string, data: { title: string; content: string }) => {
      await updateNote(id, data);
    },
    [updateNote],
  );

  const { saving, saved, handleSavedReset } = useAutoSave({
    noteId: note.id,
    title,
    content,
    originalTitle: note.title,
    originalContent: note.content,
    saveAction: saveContent,
  });

  const { onTitleChange: draftTitle, onContentChange: draftContent } = useDraft({
    noteId: note.id,
    saved,
    initialTitle: title,
    initialContent: content,
  });

  const handleRequestDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  useNoteKeyboardShortcuts({
    title,
    preview,
    setPreview,
    setOutlineVisible,
    onRequestDelete: handleRequestDelete,
  });

  const handleTogglePreview = useCallback(() => {
    setPreview((p) => (p === PREVIEW_EDIT ? PREVIEW_PREVIEW : PREVIEW_EDIT));
  }, []);

  const handleSwitchToEdit = useCallback(() => {
    setPreview(PREVIEW_EDIT);
  }, []);

  const handleToggleOutline = useCallback(() => {
    setOutlineVisible((v) => !v);
  }, []);

  const handleTitleChange = useCallback(
    (v: string) => {
      setTitle(v);
      handleSavedReset();
      draftTitle(v);
    },
    [handleSavedReset, draftTitle],
  );

  const handleContentChange = useCallback(
    (v: string) => {
      setContent(v);
      handleSavedReset();
      draftContent(v);
    },
    [handleSavedReset, draftContent],
  );

  const handleUploaded = useCallback((att: Attachment) => {
    setAttachments((prev) => [...prev, att]);
  }, []);

  const handleAttachmentDeleted = useCallback((attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  }, []);

  const editorRef = useRef<MarkdownEditorHandle>(null);

  useFocusOnEditMode({ editorRef, preview });

  useAutoShowOutline({
    noteId: note.id,
    initialContent: initial.content,
    editorRef,
    setOutlineVisible,
  });

  const handleHeadingClick = useCallback((line: number) => {
    editorRef.current?.scrollToLine(line);
  }, []);

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      setTags(newTags);
      void updateNote(note.id, { tags: newTags }).catch(console.error);
    },
    [note.id, updateNote],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <NoteHeader
        noteId={note.id}
        title={title}
        onTitleChange={handleTitleChange}
        preview={preview}
        onTogglePreview={handleTogglePreview}
        getContent={getContent}
        outlineVisible={outlineVisible}
        onToggleOutline={handleToggleOutline}
        tags={tags}
        allTags={allTags}
        onTagsChange={handleTagsChange}
      />
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {outlineVisible && (
          <aside className="hidden md:flex flex-col w-56 shrink-0">
            <NoteOutline headings={headings} onHeadingClick={handleHeadingClick} className="flex-1 min-h-0" />
          </aside>
        )}
        <MarkdownEditor
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          noteId={note.id}
          onFileUploaded={handleUploaded}
          preview={preview}
          notes={notes}
          onSwitchToEdit={handleSwitchToEdit}
        />
        <SaveIndicator saving={saving} saved={saved} />
      </div>
      {nonImageAttachments.length > 0 && (
        <AttachmentList
          noteId={note.id}
          attachments={nonImageAttachments}
          onDeleted={handleAttachmentDeleted}
          className="shrink-0 max-h-48 overflow-y-auto mx-2 mb-2 z-10 shadow-panel"
        />
      )}
      <DeleteNoteDialog noteId={note.id} noteTitle={title} open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </div>
  );
}
