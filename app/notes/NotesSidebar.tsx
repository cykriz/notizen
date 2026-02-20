"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createNoteAction } from "./actions";
import type { NoteSummary } from "@/lib/fsNotes";

interface NotesSidebarProps {
  notes: NoteSummary[];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function NotesSidebar({ notes }: NotesSidebarProps) {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    startTransition(async () => {
      await createNoteAction();
    });
  };

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Notizen</h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCreate}
              disabled={pending}
            >
              <Plus />
              <span className="sr-only">New Note</span>
            </Button>
          </div>
        </div>
        {notes.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <SidebarInput
              placeholder="Search notes…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              className="pl-8"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <FileText className="h-8 w-8" />
                <p className="text-sm">
                  {notes.length === 0 ? "No notes yet" : "No matching notes"}
                </p>
                {notes.length === 0 && (
                  <Button
                    onClick={handleCreate}
                    disabled={pending}
                    variant="secondary"
                    size="sm"
                  >
                    <Plus /> Create first note
                  </Button>
                )}
              </div>
            ) : (
              <SidebarMenu>
                {filtered.map((note) => {
                  const isActive = pathname === `/notes/${note.id}`;
                  return (
                    <SidebarMenuItem key={note.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-auto py-2"
                      >
                        <Link
                          href={`/notes/${note.id}`}
                          onClick={() => { setOpenMobile(false); }}
                        >
                          <div className="flex flex-col gap-0.5 leading-tight">
                            <span className="truncate font-medium">
                              {note.title}
                            </span>
                            <span className="text-xs text-sidebar-foreground/60">
                              {formatDate(note.updatedAt)}
                            </span>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                      {note.attachmentCount > 0 && (
                        <SidebarMenuBadge>
                          <Paperclip className="h-3 w-3" />
                          {note.attachmentCount}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
