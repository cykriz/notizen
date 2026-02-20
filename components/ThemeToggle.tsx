"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const cycle = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => { setMounted(true); });
    return () => { cancelAnimationFrame(id); };
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled />;
  }

  const current = (theme ?? "system") as keyof typeof icons;
  const Icon = icons[current];
  const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => { setTheme(next); }}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
