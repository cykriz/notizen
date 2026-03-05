'use client';

import { useState, useTransition, useCallback, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/MarkdownEditor';
import { AttachmentList } from '@/components/AttachmentList';
import { updateNoteAction } from '../actions';
import type { Note, Attachment } from '@/lib/fsNotes';
import { PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
import type { NoteSummary, PreviewMode } from '@/lib/types';
import { useAutoSave } from '@/hooks/useAutoSave';
import { NoteHeader } from './NoteHeader';
import { NoteOutline } from './NoteOutline';

interface NoteEditorProps {
  note: Note;
  allTags: string[];
  notes: NoteSummary[];
}

const saveContent = async (id: string, data: { title: string; content: string }) => {
  await updateNoteAction(id, data);
};

export function NoteEditor({ note, allTags, notes }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [attachments, setAttachments] = useState<Attachment[]>(note.attachments);
  const [, startSaving] = useTransition();
  const [preview, setPreview] = useState<PreviewMode>(note.content.trim() === '' ? PREVIEW_EDIT : PREVIEW_PREVIEW);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [outlineVisible, setOutlineVisible] = useState(() => /^#{1,6}\s+.+$/m.test(note.content));

  const deferredContent = useDeferredValue(content);
  const nonImageAttachments = useMemo(() => attachments.filter((a) => !a.mimeType.startsWith('image/')), [attachments]);

  const { saving, saved, isDirty, handleSave, handleSavedReset } = useAutoSave({
    noteId: note.id,
    title,
    content,
    originalTitle: note.title,
    originalContent: note.content,
    saveAction: saveContent,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'o' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setOutlineVisible((v) => !v);
        return;
      }

      if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPreview((p) => (p === PREVIEW_EDIT ? PREVIEW_PREVIEW : PREVIEW_EDIT));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTogglePreview = useCallback(() => {
    setPreview((p) => (p === PREVIEW_EDIT ? PREVIEW_PREVIEW : PREVIEW_EDIT));
  }, []);

  const handleToggleOutline = useCallback(() => {
    setOutlineVisible((v) => !v);
  }, []);

  const handleContentChange = useCallback(
    (v: string) => {
      setContent(v);
      handleSavedReset();
    },
    [handleSavedReset],
  );

  const handleUploaded = useCallback((att: Attachment) => {
    setAttachments((prev) => [...prev, att]);
  }, []);

  const handleAttachmentDeleted = useCallback((attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  }, []);

  const editorRef = useRef<MarkdownEditorHandle>(null);

  useEffect(() => {
    if (preview === PREVIEW_EDIT) {
      requestAnimationFrame(() => {
        editorRef.current?.focus();
      });
    }
  }, [preview]);

  const handleHeadingClick = useCallback((line: number) => {
    editorRef.current?.scrollToLine(line);
  }, []);

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      setTags(newTags);
      startSaving(async () => {
        await updateNoteAction(note.id, { tags: newTags });
      });
    },
    [note.id],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <NoteHeader
        title={title}
        onTitleChange={setTitle}
        preview={preview}
        onTogglePreview={handleTogglePreview}
        onSave={handleSave}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
        onSavedReset={handleSavedReset}
        outlineVisible={outlineVisible}
        onToggleOutline={handleToggleOutline}
        tags={tags}
        allTags={allTags}
        onTagsChange={handleTagsChange}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {outlineVisible && (
          <aside className="hidden md:flex flex-col w-56 shrink-0">
            <NoteOutline content={deferredContent} onHeadingClick={handleHeadingClick} className="flex-1 min-h-0" />
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
        />
      </div>
      {nonImageAttachments.length > 0 && (
        <AttachmentList
          noteId={note.id}
          attachments={nonImageAttachments}
          onDeleted={handleAttachmentDeleted}
          className="shrink-0 max-h-48 overflow-y-auto mx-2 mb-2 z-10 shadow-panel"
        />
      )}
    </div>
  );
}
