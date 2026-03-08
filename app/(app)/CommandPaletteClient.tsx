"use client";

import dynamic from "next/dynamic";
import type { NoteSummary } from "@/lib/fsNotes";
import type { Todo } from "@/lib/types";

const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

interface CommandPaletteClientProps {
  notes: NoteSummary[];
  todos: Todo[];
}

export function CommandPaletteClient({ notes, todos }: CommandPaletteClientProps) {
  return <CommandPalette notes={notes} todos={todos} />;
}
