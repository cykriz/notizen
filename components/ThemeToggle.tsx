// Kept for potential future use — currently not rendered anywhere.
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const cycle = ['light', 'dark', 'system'] as const;

interface ThemeToggleProps {
  size?: 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
}

export function ThemeToggle({ size = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true); 
    });
    return () => {
      cancelAnimationFrame(id); 
    };
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size={size} aria-label="Design wechseln" disabled />;
  }

  const current = (theme ?? 'system') as keyof typeof icons;
  const Icon = icons[current];
  const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];

  const themeLabels: Record<string, string> = {
    light: 'Hell',
    dark: 'Dunkel',
    system: 'System',
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={() => {
        setTheme(next); 
      }}
      aria-label={`Zu ${themeLabels[next] ?? next} wechseln`}
    >
      <Icon />
    </Button>
  );
}
