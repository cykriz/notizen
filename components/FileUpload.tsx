"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/fsNotes";

interface FileUploadProps {
  noteId: string;
  onUploaded?: (attachment: Attachment) => void;
}

export function FileUpload({ noteId, onUploaded }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.append("file", file);

          const res = await fetch(`/api/notes/${noteId}/attachments`, {
            method: "POST",
            body: form,
          });

          if (res.ok) {
            const att = (await res.json()) as Attachment;
            onUploaded?.(att);
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [noteId, onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        void upload(e.dataTransfer.files);
      }
    },
    [upload],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        void upload(e.target.files);
      }
    },
    [upload],
  );

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors cursor-pointer",
        dragging ? "border-primary bg-accent" : "border-muted",
        uploading && "opacity-50 pointer-events-none",
      )}
      onDragOver={(e) => {
        e.preventDefault(); setDragging(true); 
      }}
      onDragLeave={() => {
        setDragging(false); 
      }}
      onDrop={handleDrop}
      onClick={() => {
        inputRef.current?.click(); 
      }}
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 py-8">
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {uploading ? "Wird hochgeladen…" : "Dateien hierher ziehen oder klicken"}
        </p>
        <Button variant="secondary" size="sm" type="button" disabled={uploading}>
          Dateien auswählen
        </Button>
        <input
          ref={inputRef}
          id="file-upload"
          name="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </CardContent>
    </Card>
  );
}
