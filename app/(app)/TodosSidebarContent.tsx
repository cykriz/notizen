'use client';

import { ListChecks, Circle, CheckCircle2 } from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { TODO_COLUMN_META, columnOf } from '@/lib/todoColumns';
import type { Todo } from '@/lib/fsTodos';

interface TodosSidebarContentProps {
  todos: Todo[];
}

export function TodosSidebarContent({ todos }: TodosSidebarContentProps) {
  const open = todos.filter((t) => !t.completed).length;
  const done = todos.filter((t) => t.completed).length;

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
          <ListChecks className="h-8 w-8" />
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <Circle className="h-3 w-3" /> {open} offen
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {done} erledigt
            </span>
          </div>
        </div>

        <SidebarMenu>
          {TODO_COLUMN_META.map((q) => {
            const count = todos.filter((t) => columnOf(t) === q.key).length;
            return (
              <SidebarMenuItem key={q.key}>
                <SidebarMenuButton className="cursor-default">
                  <span>{q.label}</span>
                </SidebarMenuButton>
                {count > 0 && (
                  <SidebarMenuBadge>{count}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
