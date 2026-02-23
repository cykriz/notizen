"use client";

import Link from "next/link";
import { Paperclip } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import type { NoteSummary } from "@/lib/types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

interface NoteListItemProps {
  note: NoteSummary;
  isActive: boolean;
  onNavigate: () => void;
}

export function NoteListItem({ note, isActive, onNavigate }: NoteListItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="h-auto py-2">
        <Link href={`/notes/${note.id}`} onClick={onNavigate}>
          <div className="flex flex-col gap-0.5 leading-tight">
            <span className="truncate font-medium">{note.title}</span>
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
}
