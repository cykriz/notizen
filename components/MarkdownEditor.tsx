"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Textarea } from "@/components/ui/textarea";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <Textarea placeholder="Loading editor…" className="min-h-[400px]" disabled />
  ),
});

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div data-color-mode={resolvedTheme === "dark" ? "dark" : "light"} className="w-full">
      <MDEditor
        value={value}
        onChange={(v) => { onChange(v ?? ""); }}
        height={400}
        preview="live"
      />
    </div>
  );
}
