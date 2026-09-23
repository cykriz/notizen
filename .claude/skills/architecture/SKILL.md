---
name: architecture
description: Data model, filesystem layout, API routes, core functions, component inventory, and page structure for the notes app. Use when building new features, adding routes, or understanding how the app fits together.
---

The inventory is in the references below — **read only the ones whose path class you touch**, never
all of them. This file carries the data model and filesystem layout, because both apply to every
path class.

## References (one level deep, paths **repo-relative**)

| changed path | load |
|---|---|
| `lib/**`, `worker/**` | `.claude/skills/architecture/references/core.md` |
| `components/**`, `hooks/**`, client components under `app/(app)/**` | `.claude/skills/architecture/references/ui.md` |
| `app/api/**`, `app/share/**`, `*Actions.ts` | `.claude/skills/architecture/references/routes.md` |
| `app/**/page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx` | `.claude/skills/architecture/references/pages.md` |
| **path unclear** | `core.md` + `ui.md` — default, never leave a path class without a branch |

⚠️ **The first matching row wins.** `app/share/[token]/page.tsx` matches `app/share/**` *and*
`app/**/page.tsx`: `routes.md` counts. Where a reference needs adjacency, it carries a pointer
itself — references stay one level deep.

⚠️ **The inventory is curated, not complete** — what is listed is whatever carries a responsibility of
its own or a non-obvious rationale; purely mechanical helpers are deliberately absent. A missing
entry is therefore only a finding if the new module carries such a responsibility
(`checks.md` § "Skill Compliance": modules that *belong there*). New entries go into the
**reference of their path class**, not into this file.

## Data Model

See `lib/types.ts` for full definitions (read-aloud types: `lib/ttsTypes.ts`, shares: `lib/shareTypes.ts`). Key types:

- `NoteSummary` / `Note` — notes with tags, pinned, attachments
- `Todo` — persisted quadrants `do` (→ "Erledigen") and `inbox` (→ "Eingang"); the third column "Erledigt" is derived from `completed`. Optional `order` is the manual rank inside "Eingang" (fractional, so one drag is one write); a row without one ranks by `createdAt`, which is why the field needed no backfill — see `lib/todoOrder.ts`
- `Attachment` — file metadata with `relativePath`
- Constants live in `lib/constants.ts`; the column model (metadata, WIP limit, `columnOf`) in `lib/todoColumns.ts`

## Filesystem Layout

- Per-user root: `NOTES_ROOT/users/<username>/` (`userRootFor` in `lib/fsHelpers.ts`) — every path below is relative to it
- Notes: `notes/YYYY-MM-DD-slug-uuid/note.md` + `attachments/`
- Frontmatter in `note.md`: id, title, tags, pinned, createdAt, updatedAt
- Todos: `todos.json` (single JSON array, trash included via `trashedAt`). Rows can carry the retired quadrant `delegate` from before `cd9392c`; `readTodos` normalises every quadrant via `toUsableQuadrant` and caps "Erledigen" via `enforceDoLimit`, and the next write persists both fixes, so the file self-heals — there is deliberately no migration script
- Shares: `NOTES_ROOT/.shares/shares.json` (single JSON registry, token → { username, noteId, preset, createdAt, expiresAt })
