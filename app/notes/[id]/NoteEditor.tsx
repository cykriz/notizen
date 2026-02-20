"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { FileUpload } from "@/components/FileUpload";
import { AttachmentList } from "@/components/AttachmentList";
import { updateNoteAction, deleteNoteAction } from "../actions";
import type { Note, Attachment } from "@/lib/fsNotes";

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [attachments, setAttachments] = useState<Attachment[]>(note.attachments);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const isDirty = title !== note.title || content !== note.content;

  useEffect(() => {
    return () => {
      if (savedTimer.current) {clearTimeout(savedTimer.current);}
    };
  }, []);

  const handleSave = () => {
    startSaving(async () => {
      await updateNoteAction(note.id, { title, content });
      setSaved(true);
      if (savedTimer.current) {clearTimeout(savedTimer.current);}
      savedTimer.current = setTimeout(() => { setSaved(false); }, 2000);
    });
  };

  const handleDelete = () => {
    startDeleting(async () => {
      await deleteNoteAction(note.id);
    });
  };

  const handleUploaded = useCallback((att: Attachment) => {
    setAttachments((prev) => [...prev, att]);
  }, []);

  const handleDeleted = useCallback((attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/notes">
            <ArrowLeft /> Back
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            onClick={handleSave}
            disabled={saving || (!isDirty && !saved)}
            size="sm"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saved ? "Saved!" : "Save"}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Trash2 />
                )}
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete note?</DialogTitle>
                <DialogDescription>
                  This will permanently delete &quot;{note.title}&quot; and all
                  its attachments.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 />
                  )}
                  Delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setSaved(false);
        }}
        placeholder="Note title…"
        className="mb-6 text-lg font-semibold h-12"
      />

      <div className="mb-8">
        <MarkdownEditor
          value={content}
          onChange={(v) => {
            setContent(v);
            setSaved(false);
          }}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Attachments</h2>
        <FileUpload noteId={note.id} onUploaded={handleUploaded} />
        <AttachmentList
          noteId={note.id}
          attachments={attachments}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  );
}
