"use client";

import { useState } from "react";
import { QuadrantCard, quadrants } from "./QuadrantCard";
import { TodoDialog } from "./TodoDialog";
import type { Todo, TodoQuadrant } from "@/lib/fsTodos";

interface EisenhowerMatrixProps {
  todos: Todo[];
}

export function EisenhowerMatrix({ todos }: EisenhowerMatrixProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | undefined>(undefined);
  const [defaultQuadrant, setDefaultQuadrant] = useState<TodoQuadrant>("do");

  const handleAdd = (quadrant: TodoQuadrant) => {
    setEditingTodo(undefined);
    setDefaultQuadrant(quadrant);
    setDialogOpen(true);
  };

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setDefaultQuadrant(todo.quadrant);
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTodo(undefined);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 p-4">
        {quadrants.map((meta) => (
          <QuadrantCard
            key={meta.key}
            meta={meta}
            todos={todos.filter((t) => t.quadrant === meta.key)}
            onAdd={handleAdd}
            onEdit={handleEdit}
          />
        ))}
      </div>
      <TodoDialog
        key={editingTodo?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        todo={editingTodo}
        defaultQuadrant={defaultQuadrant}
      />
    </>
  );
}
