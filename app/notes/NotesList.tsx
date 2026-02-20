"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createNoteAction } from "./actions";
import type { NoteSummary } from "@/lib/fsNotes";

interface NotesListProps {
  notes: NoteSummary[];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NotesList({ notes }: NotesListProps) {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    startTransition(async () => {
      await createNoteAction();
    });
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Notizen</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleCreate} disabled={pending}>
              <Plus />
              <span className="hidden sm:inline">New Note</span>
            </Button>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              className="pl-10"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
            <FileText className="h-12 w-12" />
            <p className="text-lg">
              {notes.length === 0 ? "No notes yet" : "No matching notes"}
            </p>
            {notes.length === 0 && (
              <Button
                onClick={handleCreate}
                disabled={pending}
                variant="secondary"
              >
                <Plus /> Create your first note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <Card className="transition-colors hover:bg-accent/50 py-4">
                  <CardHeader className="px-5 py-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base">
                          {note.title}
                        </CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="truncate max-w-[200px] sm:max-w-none">
                            {note.slug}
                          </span>
                          <span>{formatDate(note.updatedAt)}</span>
                        </CardDescription>
                      </div>
                      {note.attachmentCount > 0 && (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <Paperclip className="h-3 w-3" />
                          {note.attachmentCount}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
