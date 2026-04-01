# Notes App

Next.js 16 + React 19 + Bun + TypeScript (strict) + Tailwind v4 + shadcn/ui. Filesystem-only storage (no database). PWA via Serwist.

## Commands

- `bun install` (not npm), `bun run lint`, `bunx tsc --noEmit`
- Run lint + tsc after every code change. Fix all errors before moving on.
- Dev server: `bun --bun next dev`
- Add shadcn component: `npx shadcn@latest add <name>`

## Code Rules

- Extract repeated string literals (modes, statuses, quadrants) into `lib/constants.ts` with types in `lib/types.ts` — never scatter raw literals across files

## Key Rules

- All user-facing text in **German**
- Max 200 lines per file — split if exceeded
- `NOTES_ROOT` env var points to data directory
- `revalidatePath()` after mutations
- No database, no experimental Next.js features, no new packages without updating this file
- Tags are hierarchical, slash-separated (e.g. `dev/python/fastapi`)
- All features must work offline — the app is a PWA with a service worker; never assume server data is fresh or available

## Style Rules

- Always Tailwind CSS — never inline `style={{}}`
- Never hardcode colors (`bg-blue-500`, `#fff`) — use semantic tokens (`bg-primary`, `text-muted-foreground`)
- Never use `dark:` prefix — CSS variables in `app/globals.css` handle light/dark
- `cn()` with object syntax only: `cn("base", { "bg-accent": isActive })` — never ternaries or `&&`
- Shared visual classes go in `app/custom-components.css`, not per-component
- Use shadcn/ui from `components/ui/` — never raw HTML when a shadcn equivalent exists
- To add a color: define in `:root` + `.dark` in `globals.css`, register in `@theme inline`

## Approved Packages

```
uuid zod gray-matter cmdk
shadcn/ui next-themes radix-ui lucide-react
class-variance-authority clsx tailwind-merge tw-animate-css
@uiw/react-codemirror @codemirror/lang-markdown @codemirror/search @codemirror/commands @codemirror/view @codemirror/state
@serwist/turbopack serwist
```
