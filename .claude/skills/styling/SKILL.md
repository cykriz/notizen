---
name: styling
description: Design token system, color tokens, shared CSS classes, and component styling patterns. Use when adding colors, adjusting theming, or modifying shared visual styles.
---

## Color Tokens

All defined as CSS variables in `app/globals.css` (`:root` for light, `.dark` for dark), registered via `@theme inline`.

**Core:** background, foreground, card, card-foreground, popover, popover-foreground, primary, primary-foreground, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, destructive, border, input, ring

**Quadrant:** quadrant-do, quadrant-do-foreground, quadrant-schedule, quadrant-schedule-foreground, quadrant-delegate, quadrant-delegate-foreground, quadrant-planned, quadrant-planned-foreground

**Chart:** chart-1, chart-2, chart-3, chart-4, chart-5

**Sidebar:** sidebar, sidebar-foreground, sidebar-primary, sidebar-primary-foreground, sidebar-accent, sidebar-accent-foreground, sidebar-border, sidebar-ring

**Other:** panel-shadow, input-dark-bg

## Shared CSS Classes (`app/custom-components.css`)

Global classes for consistent visuals. Use plain CSS values — avoid `@apply` beyond well-known Tailwind v4 utilities (Turbopack can fail on unresolved utilities).

| Class | Used on | Controls |
|---|---|---|
| `.card-base` | Card, MobileBottomNav | `rounded-xl shadow-sm` — shared panel look (no border) |
| `.sidebar-inner` | Desktop sidebar, mobile SheetContent | `flex h-full w-full flex-col p-2 gap-2` |
| `.sidebar-panel` | Desktop sidebar, mobile SheetContent | `border-0 gap-2` |
| `.note-section-padding` | Note section elements | `px-4 py-2` |
| `.note-outline-aside` | NoteEditor, SharedNoteView | `hidden md:flex flex-col shrink-0`, `width: clamp(14rem, 20vw, 22rem)` |

## Theme System

- Dark/light via `next-themes` (class-based, `.dark` on `<html>`)
- ThemeProvider in `app/providers.tsx`
- Prefer CVA variants over inline Tailwind overrides for multiple visual styles
