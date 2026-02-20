'use client';

import { useState, useTransition, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { Save, Trash2, Loader2, Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { updateNoteAction, deleteNoteAction } from '../actions';
import type { Note, Attachment } from '@/lib/fsNotes';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const emptySubscribe = () => noop;

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<'edit' | 'preview'>('edit');
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDirty = title !== note.title || content !== note.content;

  useEffect(() => {
    return () => {
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    };
  }, []);

  const handleSave = () => {
    startSaving(async () => {
      await updateNoteAction(note.id, { title, content });
      setSaved(true);
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
      savedTimer.current = setTimeout(() => {
        setSaved(false);
      }, 2000);
    });
  };

  const handleDelete = () => {
    startDeleting(async () => {
      await deleteNoteAction(note.id);
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleUploaded = useCallback((_att: Attachment) => {}, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 shadow-[0_-28px_50px_40px_rgba(235,235,235,0.9)] dark:shadow-[0_-28px_50px_40px_rgba(0,0,0)] z-10">
        <Input
          id="note-title"
          name="note-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          placeholder="Note title…"
          rounded={false}
          className="flex-1 text-2xl font-semibold h-14 border-none shadow-none focus-visible:ring-0 placeholder:text-2xl"
        />
        <Button
          onClick={() => {
            setPreview((p) => (p === 'edit' ? 'preview' : 'edit'));
          }}
          size="sm"
          variant="ghost"
        >
          {preview === 'edit' ? <Eye /> : <Pencil />}
        </Button>
        <Button onClick={handleSave} disabled={saving || (!isDirty && !saved)} size="sm" variant="ghost">
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saved ? 'Saved!' : 'Save'}
        </Button>

        {mounted ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete note?</DialogTitle>
                <DialogDescription>
                  This will permanently delete &quot;{note.title}&quot; and all its attachments.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  Delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            <Trash2 />
          </Button>
        )}
      </div>

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
