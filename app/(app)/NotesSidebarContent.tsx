"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import { createNoteAction } from "./notes/actions";
import type { NoteSummary } from "@/lib/fsNotes";

interface NotesSidebarContentProps {
  notes: NoteSummary[];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function NotesSidebarContent({ notes }: NotesSidebarContentProps) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const handleCreate = () => {
    startTransition(async () => {
      await createNoteAction();
    });
  };

  return (
    <>
      <div className="px-4 pb-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCreate}
          disabled={pending}
          className="w-full justify-start"
        >
          <Plus />
          Neue Notiz
        </Button>
      </div>

      <SidebarGroup>
        <SidebarGroupContent>
          {notes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Noch keine Notizen</p>
              <Button
                onClick={handleCreate}
                disabled={pending}
                variant="secondary"
                size="sm"
              >
                <Plus /> Erste Notiz erstellen
              </Button>
            </div>
          ) : (
            <SidebarMenu>
              {notes.map((note) => {
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
                        onClick={() => {
                          setOpenMobile(false);
                        }}
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
    </>
  );
}
