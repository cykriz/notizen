"use client";

import { useState } from "react";
import { Download, Trash2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Attachment } from "@/lib/fsNotes";

interface AttachmentListProps {
  noteId: string;
  attachments: Attachment[];
  onDeleted?: (attId: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ noteId, attachments, onDeleted }: AttachmentListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (attId: string) => {
    setDeleting(attId);
    try {
      const res = await fetch(`/api/notes/${noteId}/attachments/${attId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted?.(attId);
      }
    } finally {
      setDeleting(null);
    }
  };

  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Keine Anhänge</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.map((att) => (
        <Card key={att.id} className="py-3">
          <CardContent className="flex items-center gap-3 px-4 py-0">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{att.originalName}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge variant="secondary">{att.mimeType}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatSize(att.size)}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon-xs" asChild>
                <a
                  href={`/api/notes/${noteId}/attachments/${att.id}/download`}
                  download={att.originalName}
                >
                  <Download />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  void handleDelete(att.id); 
                }}
                disabled={deleting === att.id}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
