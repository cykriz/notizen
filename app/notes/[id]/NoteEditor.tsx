'use client';

import { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { updateNoteAction } from '../actions';
import type { Note, Attachment } from '@/lib/fsNotes';
import { NoteHeader } from './NoteHeader';

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<'edit' | 'preview'>('edit');
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

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleUploaded = useCallback((_att: Attachment) => {}, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <NoteHeader
        noteId={note.id}
        title={title}
        onTitleChange={setTitle}
        noteTitle={note.title}
        preview={preview}
        onTogglePreview={() => {
          setPreview((p) => (p === 'edit' ? 'preview' : 'edit')); 
        }}
        onSave={handleSave}
        saving={saving}
        saved={saved}
        isDirty={isDirty}
        onSavedReset={() => {
          setSaved(false); 
        }}
      />

      <div className="flex-1 min-h-0">
        <MarkdownEditor
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
    </div>
  );
}
