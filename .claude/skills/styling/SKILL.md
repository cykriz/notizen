---
name: styling
description: Design token system, color tokens, shared CSS classes, and component styling patterns. Use when adding colors, adjusting theming, or modifying shared visual styles.
---

## Color Tokens

All defined as CSS variables in `app/globals.css` (`:root` for light, `.dark` for dark), registered via `@theme inline`.

**Core:** background, foreground, card, card-foreground, popover, popover-foreground, primary, primary-foreground, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, destructive, border, input, ring

**Quadrant:** quadrant-do, quadrant-do-foreground, quadrant-schedule, quadrant-schedule-foreground, quadrant-inbox, quadrant-inbox-foreground, quadrant-planned, quadrant-planned-foreground

**Chart:** chart-1, chart-2, chart-3, chart-4, chart-5

**Sidebar:** sidebar, sidebar-foreground, sidebar-primary, sidebar-primary-foreground, sidebar-accent, sidebar-accent-foreground, sidebar-border, sidebar-ring

**Other:** panel-shadow, input-dark-bg

## Shared CSS Classes (`app/custom-components.css`)

Global classes for consistent visuals. Extract a class into this file **only once it has a second consumer** — one-off custom styles stay inline at the call site. Use plain CSS values — avoid `@apply` beyond well-known Tailwind v4 utilities (Turbopack can fail on unresolved utilities).

| Class | Used on | Controls |
|---|---|---|
| `.card-base` | Card, MobileBottomNav | `rounded-xl shadow-sm` — shared panel look (no border) |
| `.sidebar-inner` | Desktop sidebar, mobile SheetContent | `flex h-full w-full flex-col p-2 gap-2` |
| `.sidebar-panel` | Desktop sidebar, mobile SheetContent | `border-0 gap-2` |
| `.note-section-padding` | Note section elements | `px-4 py-2` |
| `.note-outline-aside` | NoteEditor, SharedNoteView | `hidden md:flex flex-col shrink-0`, `width: clamp(14rem, 20vw, 22rem)` |
| `.sidebar-label` | NotesSidebarFooter selection count, TagBreadcrumb current folder | `min-w-0 flex-1 truncate px-1 text-xs` — non-clickable row text; **layout only**, the colour stays at the call site (this file is unlayered, so a colour baked in here could not be overridden) |
| `.menu-row` | NoteActionsMenu, TagBreadcrumb path menu | `w-full justify-start gap-2 font-normal h-11 md:h-9` — Button that reads as a menu entry; owns the finger-vs-mouse height so the menus cannot drift apart |

## Theme System

- Dark/light via `next-themes` (class-based, `.dark` on `<html>`)
- ThemeProvider in `app/providers.tsx`
- Prefer CVA variants over inline Tailwind overrides for multiple visual styles
