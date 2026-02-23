"use client";

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, Folder, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import { buildTagTree, getChildNodes, getNotesAtPath } from "@/lib/tagTree";
import { NoteListItem } from "./NoteListItem";
import type { NoteSummary } from "@/lib/types";

interface TagBrowserProps {
  notes: NoteSummary[];
}

export function TagBrowser({ notes }: TagBrowserProps) {
  const [currentPath, setCurrentPath] = useState("");
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const tree = useMemo(() => buildTagTree(notes), [notes]);
  const children = useMemo(() => getChildNodes(tree, currentPath), [tree, currentPath]);
  const notesAtLevel = useMemo(() => getNotesAtPath(notes, currentPath), [notes, currentPath]);
  const pathSegments = currentPath !== "" ? currentPath.split("/") : [];

  const handleBack = () => {
    const parts = currentPath.split("/");
    parts.pop();
    setCurrentPath(parts.join("/"));
  };

  return (
    <div className="flex flex-col gap-1">
      {currentPath !== "" && (
        <div className="flex items-center gap-1 px-2 text-xs text-sidebar-foreground/70">
          <Button variant="ghost" size="icon-xs" onClick={handleBack} className="shrink-0">
            <ChevronLeft />
          </Button>
          {pathSegments.map((seg, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <span>/</span>}
              <button
                onClick={() => {
                  setCurrentPath(pathSegments.slice(0, i + 1).join("/")); 
                }}
                className="hover:underline truncate max-w-24"
              >
                {seg}
              </button>
            </span>
          ))}
        </div>
      )}

      {children.length > 0 && (
        <SidebarMenu>
          {children.map((node) => (
            <SidebarMenuItem key={node.fullPath}>
              <SidebarMenuButton
                onClick={() => {
                  setCurrentPath(node.fullPath); 
                }}
                className="h-auto py-1.5"
              >
                {node.children.length > 0 ? (
                  <Folder className="shrink-0" />
                ) : (
                  <Tag className="shrink-0" />
                )}
                <span className="truncate">{node.segment}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{node.noteCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}

      {notesAtLevel.length > 0 && children.length > 0 && (
        <Separator className="mx-2" />
      )}

      {notesAtLevel.length > 0 && (
        <SidebarMenu>
          {notesAtLevel.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={pathname === `/notes/${note.id}`}
              onNavigate={() => {
                setOpenMobile(false); 
              }}
            />
          ))}
        </SidebarMenu>
      )}

      {children.length === 0 && notesAtLevel.length === 0 && (
        <p className="px-4 py-4 text-xs text-muted-foreground text-center">
          Keine Notizen mit diesem Tag
        </p>
      )}
    </div>
  );
}
