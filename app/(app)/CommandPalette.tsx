"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, ListChecks, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type { NoteSummary } from "@/lib/fsNotes";
import type { Todo } from "@/lib/types";

interface CommandPaletteProps {
  notes: NoteSummary[];
  todos: Todo[];
}

export function CommandPalette({ notes, todos }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Befehlspalette"
      description="Suche nach Notizen oder Aufgaben…"
      showCloseButton={false}
    >
      <CommandInput placeholder="Suchen…" />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>

        {notes.length > 0 && (
          <CommandGroup heading="Notizen">
            {notes.map((note) => (
              <CommandItem
                key={note.id}
                value={[note.title, ...note.tags.map((t) => `#${t}`)].join(" ")}
                onSelect={() => {
                  navigate(`/notes/${note.id}`);
                }}
              >
                {note.pinned ? <Pin /> : <FileText />}
                <span className="truncate">{note.title}</span>
                {note.tags.slice(0, 2).map((tag, i) => (
                  <Badge key={tag} variant="secondary" className={cn("text-xs px-1 py-0", { "ml-auto": i === 0 })}>
                    {tag.split("/").pop()}
                  </Badge>
                ))}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {todos.length > 0 && (
          <CommandGroup heading="Aufgaben">
            {todos.map((todo) => (
              <CommandItem
                key={todo.id}
                value={todo.title}
                onSelect={() => {
                  navigate("/todos");
                }}
              >
                <ListChecks />
                <span className="truncate">{todo.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
