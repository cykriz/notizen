'use client';

import { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/MarkdownEditor';
import { AttachmentList } from '@/components/AttachmentList';
import { updateNoteAction } from '../actions';
import type { Note, Attachment } from '@/lib/fsNotes';
import { PREVIEW_EDIT, PREVIEW_PREVIEW } from '@/lib/constants';
import type { PreviewMode } from '@/lib/types';
import { NoteHeader } from './NoteHeader';
import { NoteOutline } from './NoteOutline';

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [attachments, setAttachments] = useState<Attachment[]>(note.attachments);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<PreviewMode>(note.content.trim() === '' ? PREVIEW_EDIT : PREVIEW_PREVIEW);
  const [outlineVisible, setOutlineVisible] = useState(() => /^#{1,6}\s+.+$/m.test(note.content));
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const isDirty = title !== note.title || content !== note.content;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const latestTitle = useRef(title);
  const latestContent = useRef(content);

  useEffect(() => {
    latestTitle.current = title;
    latestContent.current = content;
  }, [title, content]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }

      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  const showSavedFeedback = useCallback(() => {
    setSaved(true);
    if (savedTimer.current) {
      clearTimeout(savedTimer.current);
    }

    savedTimer.current = setTimeout(() => {
      setSaved(false);
    }, 2000);
  }, []);

  const handleSave = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    startSaving(async () => {
      await updateNoteAction(note.id, { title: latestTitle.current, content: latestContent.current });
      showSavedFeedback();
    });
  };

  useEffect(() => {
    if (title === note.title && content === note.content) {
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      startSaving(async () => {
        await updateNoteAction(note.id, { title: latestTitle.current, content: latestContent.current });
        showSavedFeedback();
      });
    }, 1000);
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [title, content, note.id, note.title, note.content, showSavedFeedback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <NoteHeader
        noteId={note.id}
        title={title}
        onTitleChange={setTitle}
        noteTitle={note.title}
        preview={preview}
        onTogglePreview={() => {
          setPreview((p) => (p === PREVIEW_EDIT ? PREVIEW_PREVIEW : PREVIEW_EDIT));
        }}
        onSave={handleSave}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
        onSavedReset={() => {
          setSaved(false);
        }}
        outlineVisible={outlineVisible}
        onToggleOutline={() => {
          setOutlineVisible((v) => !v);
        }}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {outlineVisible && (
          <aside className="hidden lg:block w-56 shrink-0 overflow-hidden">
            <NoteOutline content={content} onHeadingClick={handleHeadingClick} />
          </aside>
        )}
        <MarkdownEditor
          ref={editorRef}
          value={content}
          onChange={(v) => {
            setContent(v);
            setSaved(false);
          }}
          noteId={note.id}
          onFileUploaded={handleUploaded}
          preview={preview}
        />
      </div>
      {attachments.length > 0 && (
        <AttachmentList
          noteId={note.id}
          attachments={attachments}
          onDeleted={handleAttachmentDeleted}
          className="shrink-0 max-h-48 overflow-y-auto mx-4 mb-4 z-10 shadow-panel"
        />
      )}
    </div>
  );
}
