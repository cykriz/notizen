import { useState, useTransition, useCallback, useRef, useEffect } from 'react';
import { FEEDBACK_FLASH_MS } from '@/lib/constants';
import { buildNoteSavePayload } from '@/lib/noteSavePayload';
import type { UpdateNoteInput } from '@/lib/offlineNotes';

interface UseAutoSaveOptions {
  noteId: string;
  title: string;
  content: string;
  originalTitle: string;
  originalContent: string;
  saveAction: (id: string, data: UpdateNoteInput) => Promise<unknown>;
}

export function useAutoSave({
  noteId,
  title,
  content,
  originalTitle,
  originalContent,
  saveAction,
}: UseAutoSaveOptions) {
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const latestTitle = useRef(title);
  const latestContent = useRef(content);

  useEffect(() => {
    latestTitle.current = title;
    latestContent.current = content;
  }, [title, content]);

  useEffect(
    () => () => {
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }

      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    },
    [],
  );

  const showSavedFeedback = useCallback(() => {
    setSaved(true);
    if (savedTimer.current) {
      clearTimeout(savedTimer.current);
    }

    savedTimer.current = setTimeout(() => {
      setSaved(false);
    }, FEEDBACK_FLASH_MS);
  }, []);

  const isDirty = title !== originalTitle || content !== originalContent;

  const doSave = useCallback(() => {
    startSaving(async () => {
      await saveAction(noteId, buildNoteSavePayload(latestTitle.current, latestContent.current));
      showSavedFeedback();
    });
  }, [noteId, saveAction, showSavedFeedback]);

  const handleSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    doSave();
  }, [doSave]);

  const handleSavedReset = useCallback(() => {
    setSaved(false); 
  }, []);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(doSave, 1000);
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [title, content, isDirty, doSave]);

  return { saving, saved, isDirty, handleSave, handleSavedReset };
}
