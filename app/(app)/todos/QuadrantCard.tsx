"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TodoCard } from './TodoCard';
import { QUADRANT_META } from '@/lib/constants';
import type { QuadrantMeta, NoteSummary } from '@/lib/types';
import type { Todo, TodoQuadrant } from '@/lib/fsTodos';

interface QuadrantCardMeta extends QuadrantMeta {
  colorClass: string;
  headerClass: string;
}

const colorMap: Record<TodoQuadrant, { colorClass: string; headerClass: string }> = {
  do: { colorClass: "bg-quadrant-do text-quadrant-do-foreground", headerClass: "text-quadrant-do-foreground" },
  schedule: { colorClass: "bg-quadrant-schedule text-quadrant-schedule-foreground", headerClass: "text-quadrant-schedule-foreground" },
  delegate: { colorClass: "bg-quadrant-delegate text-quadrant-delegate-foreground", headerClass: "text-quadrant-delegate-foreground" },
  eliminate: { colorClass: "bg-quadrant-eliminate text-quadrant-eliminate-foreground", headerClass: "text-quadrant-eliminate-foreground" },
};

export const quadrants: QuadrantCardMeta[] = QUADRANT_META.map((m) => ({
  ...m,
  ...colorMap[m.key],
}));

interface QuadrantCardProps {
  meta: QuadrantCardMeta;
  todos: Todo[];
  onAdd: (quadrant: TodoQuadrant) => void;
  onEdit: (todo: Todo) => void;
  notes: NoteSummary[];
}

export function QuadrantCard({ meta, todos, onAdd, onEdit, notes }: QuadrantCardProps) {
  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <Card className="flex flex-col min-h-0 overflow-hidden gap-0 py-0">
      <CardHeader className={cn("flex-row items-center gap-2 py-2.5 px-3", meta.colorClass)}>
        <div className="flex-1 min-w-0">
          <CardTitle className={cn("text-sm font-semibold", meta.headerClass)}>
            {meta.label}
          </CardTitle>
          <p className={cn("text-xs opacity-75", meta.headerClass)}>{meta.description}</p>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          className={meta.headerClass}
          onClick={() => {
            onAdd(meta.key); 
          }}
        >
          <Plus />
          <span className="sr-only">Aufgabe hinzufügen</span>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-1.5 px-0">
        {open.length === 0 && done.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Keine Aufgaben</p>
        )}
        {open.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} />
        ))}
        {done.length > 0 && open.length > 0 && (
          <div className="my-1 border-t" />
        )}
        {done.map((t) => (
          <TodoCard key={t.id} todo={t} onEdit={onEdit} notes={notes} />
        ))}
      </CardContent>
    </Card>
  );
}
