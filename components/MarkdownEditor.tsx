"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/fsNotes";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

type PreviewMode = "edit" | "preview";

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  noteId?: string;
  onFileUploaded?: (attachment: Attachment) => void;
  preview?: PreviewMode;
}

function buildMarkdownLink(att: Attachment, noteId: string): string {
  const url = `/api/notes/${noteId}/attachments/${att.id}/download`;
  if (att.mimeType.startsWith("image/")) {
    return `![${att.originalName}](${url})`;
  }
  return `[${att.originalName}](${url})`;
}

export function MarkdownEditor({ value, onChange, noteId, onFileUploaded, preview = "edit" }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => { setMounted(true); });
    return () => { cancelAnimationFrame(id); };
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (noteId === undefined || noteId === "" || e.dataTransfer.files.length === 0) {return;}

      setUploading(true);
      try {
        const links: string[] = [];
        for (const file of Array.from(e.dataTransfer.files)) {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`/api/notes/${noteId}/attachments`, {
            method: "POST",
            body: form,
          });
          if (res.ok) {
            const att = (await res.json()) as Attachment;
            onFileUploaded?.(att);
            links.push(buildMarkdownLink(att, noteId));
          }
        }
        if (links.length > 0) {
          const insertion = links.join("\n");
          const textarea = wrapperRef.current?.querySelector("textarea");
          const pos = textarea?.selectionStart ?? value.length;
          const before = value.slice(0, pos);
          const after = value.slice(pos);
          const sep = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
          onChange(`${before + sep + insertion  }\n${  after}`);
        }
      } finally {
        setUploading(false);
      }
    },
    [noteId, value, onChange, onFileUploaded],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (noteId !== undefined && noteId !== "") {setDragging(true);}
  }, [noteId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }, []);

  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div
      ref={wrapperRef}
      data-color-mode={colorMode}
      className={cn("w-full h-full relative", dragging && "ring-2 ring-primary")}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <MDEditor
        value={value}
        onChange={(v) => { onChange(v ?? ""); }}
        height="100%"
        preview={preview}
        hideToolbar
      />
      {dragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/80 pointer-events-none z-10">
          <p className="text-sm font-medium text-accent-foreground">
            Drop to upload &amp; insert link
          </p>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 pointer-events-none z-10">
          <p className="text-sm font-medium text-muted-foreground">Uploading…</p>
        </div>
      )}
    </div>
  );
}
