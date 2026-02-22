"use client";

import { useTransition } from "react";
import { Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toggleTodoAction } from "./actions";
import type { Todo } from "@/lib/fsTodos";

interface TodoCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function TodoCard({ todo, onEdit }: TodoCardProps) {
  const [, startToggle] = useTransition();

  const handleToggle = (checked: boolean) => {
    startToggle(async () => {
      await toggleTodoAction(todo.id, checked);
    });
  };

  return (
    <div
      className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer"
      onClick={() => {
        onEdit(todo); 
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(todo);
        }
      }}
    >
      <div
        className="pt-0.5"
        onClick={(e) => {
          e.stopPropagation(); 
        }}
        onKeyDown={(e) => {
          e.stopPropagation(); 
        }}
        role="presentation"
      >
        <Checkbox
          checked={todo.completed}
          onCheckedChange={(checked) => {
            handleToggle(checked === true); 
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm leading-tight", { "line-through text-muted-foreground": todo.completed })}>
          {todo.title}
        </span>
        {todo.dueDate !== undefined && (
          <Badge
            variant={!todo.completed && isOverdue(todo.dueDate) ? "destructive" : "secondary"}
            className="ml-2 text-[10px] px-1.5 py-0"
          >
            <Calendar className="h-2.5 w-2.5 mr-0.5" />
            {formatDate(todo.dueDate)}
          </Badge>
        )}
      </div>
    </div>
  );
}
