---
name: architecture
description: Data model, filesystem layout, API routes, core functions, component inventory, and page structure for the notes app. Use when building new features, adding routes, or understanding how the app fits together.
---

Der Bestand steht in den Referenzen unten — **lies nur die, deren Pfadklasse du anfasst**, nie alle.
Diese Datei trägt Datenmodell und Filesystem-Layout, weil beide für jede Pfadklasse gelten.

## Referenzen (eine Ebene tief, Pfade **repo-relativ**)

| geänderter Pfad | laden |
|---|---|
| `lib/**`, `worker/**` | `.claude/skills/architecture/references/core.md` |
| `components/**`, `hooks/**`, Client-Komponenten unter `app/(app)/**` | `.claude/skills/architecture/references/ui.md` |
| `app/api/**`, `app/share/**`, `*Actions.ts` | `.claude/skills/architecture/references/routes.md` |
| `app/**/page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx` | `.claude/skills/architecture/references/pages.md` |
| **Pfad unklar** | `core.md` + `ui.md` — Default, nie eine Pfadklasse ohne Zweig lassen |

⚠️ **Erste passende Zeile gewinnt.** `app/share/[token]/page.tsx` trifft `app/share/**` *und*
`app/**/page.tsx`: es zählt `routes.md`. Wo eine Referenz Nachbarschaft braucht, trägt sie selbst einen
Zeiger — Referenzen bleiben eine Ebene tief.

⚠️ **Das Inventar ist kuratiert, nicht vollständig** — verzeichnet ist, was eine eigene Zuständigkeit
oder eine nicht-offensichtliche Begründung trägt; rein mechanische Helfer fehlen bewusst. Ein fehlender
Eintrag ist deshalb nur dann ein Finding, wenn das neue Modul eine solche Zuständigkeit trägt
(`checks.md` § "Skill Compliance": Module, die *dorthin gehören*). Neue Einträge kommen in die
**Referenz ihrer Pfadklasse**, nicht in diese Datei.

## Data Model

See `lib/types.ts` for full definitions (read-aloud types: `lib/ttsTypes.ts`, shares: `lib/shareTypes.ts`). Key types:

- `NoteSummary` / `Note` — notes with tags, pinned, attachments
- `Todo` — persisted quadrants `do` (→ "Erledigen") and `inbox` (→ "Eingang"); the third column "Erledigt" is derived from `completed`
- `Attachment` — file metadata with `relativePath`
- Constants live in `lib/constants.ts`; the column model (metadata, WIP limit, `columnOf`) in `lib/todoColumns.ts`

## Filesystem Layout

- Per-user root: `NOTES_ROOT/users/<username>/` (`userRootFor` in `lib/fsHelpers.ts`) — every path below is relative to it
- Notes: `notes/YYYY-MM-DD-slug-uuid/note.md` + `attachments/`
- Frontmatter in `note.md`: id, title, tags, pinned, createdAt, updatedAt
- Todos: `todos.json` (single JSON array, trash included via `trashedAt`). Rows can carry retired quadrants (`delegate` from before `cd9392c`, `schedule`/`planned` from the four-quadrant board); `readTodos` normalises every quadrant via `toUsableQuadrant` and caps "Erledigen" via `enforceDoLimit`, and the next write persists both fixes, so the file self-heals — there is deliberately no migration script (`scripts/todo-migration-report.ts` only *reports*, it writes nothing)
- Shares: `NOTES_ROOT/.shares/shares.json` (single JSON registry, token → { username, noteId, preset, createdAt, expiresAt })
