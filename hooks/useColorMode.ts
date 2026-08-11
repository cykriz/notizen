'use client';

import { useTheme } from 'next-themes';
import { useClientMounted } from './useClientMounted';

/**
 * The resolved theme, but never before the mount.
 *
 * next-themes seeds `resolvedTheme` from localStorage and `matchMedia` inside its
 * own state initializer, so it already holds the real value during the hydration
 * render while the server HTML does not — see hooks/useClientMounted.ts. Reading it
 * unguarded swaps theme classes and throws React #418, which is exactly how
 * MarkdownEditor's CodeMirror `theme` prop broke while the `data-color-mode`
 * attribute two lines above it was correct.
 *
 * `fallback` is what the server and the hydration render use, so it decides which
 * users see a one-frame flash: pass the theme the surrounding markup assumes.
 */
export function useColorMode(fallback: 'light' | 'dark'): string {
  const { resolvedTheme } = useTheme();
  const mounted = useClientMounted();
  return (mounted ? resolvedTheme : undefined) ?? fallback;
}
