'use client';

import { useMemo } from 'react';
import { ChevronLeft, Folder, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from '@/components/ui/sidebar';
import { buildTagTree, getChildNodes } from '@/lib/tagTree';
import type { NoteSummary } from '@/lib/types';

interface TagNavigationProps {
  notes: NoteSummary[];
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

export function TagNavigation({ notes, currentPath, setCurrentPath }: TagNavigationProps) {
  const tree = useMemo(() => buildTagTree(notes), [notes]);
  const children = useMemo(() => getChildNodes(tree, currentPath), [tree, currentPath]);
  const hasNotesAtLevel = useMemo(
    () =>
      currentPath === ''
        ? notes.some((n) => n.tags.length === 0)
        : notes.some((n) => n.tags.includes(currentPath)),
    [notes, currentPath],
  );
  const pathSegments = currentPath !== '' ? currentPath.split('/') : [];

  const handleBack = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  if (children.length === 0 && currentPath === '') {
    return null;
  }

  return (
    <div className="flex max-h-[50%] flex-col gap-1 overflow-y-auto">
      {currentPath !== '' && (
        <div className="flex min-w-0 items-center gap-1 overflow-hidden px-2 text-xs text-sidebar-foreground/70">
          <Button variant="ghost" size="icon-xs" onClick={handleBack} className="shrink-0">
            <ChevronLeft />
          </Button>
          {pathSegments.map((seg, i) => (
            <span key={i} className="flex min-w-0 items-center gap-0.5">
              {i > 0 && <span className="shrink-0">/</span>}
              <Button
                variant="link"
                size="xs"
                onClick={() => {
                  setCurrentPath(pathSegments.slice(0, i + 1).join('/'));
                }}
                className="min-w-0 overflow-hidden max-w-24 py-2 h-auto"
              >
                <span className="truncate">{seg}</span>
              </Button>
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
                className="h-auto"
              >
                {node.children.length > 0 ? <Folder className="shrink-0" /> : <Tag className="shrink-0" />}
                <span className="truncate">{node.segment}</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>{node.noteCount}</SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}

      {hasNotesAtLevel && children.length > 0 && <Separator className="mx-2" />}
    </div>
  );
}
