"use client";

import dynamic from "next/dynamic";
import { useData } from "./DataProvider";

const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteClient() {
  const { notes, todos } = useData();
  return <CommandPalette notes={notes} todos={todos} />;
}
