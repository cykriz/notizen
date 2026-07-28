# Notes App

Next.js 16 + React 19 + Bun + TypeScript (strict) + Tailwind v4 + shadcn/ui. Filesystem-only storage (no database). PWA via Serwist.

## Commands

- `bun install` (not npm), `bun run lint`, `bunx tsc --noEmit`
- Run lint + tsc after every code change. Fix all errors before moving on.
- Dev server: `bun --bun next dev`
- Add shadcn component: `npx shadcn@latest add <name>`
- E2E tests: `bun run test:e2e` (headless), `bun run test:e2e:ui` (UI mode). Browser install: `bunx playwright install chromium`. Only Playwright's test *runner* falls back to `npx` (needs Node's module loader) — everything else (install, scripts, queries) uses `bun`/`bunx`.
- Install git hooks: `cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`

## Code Rules

- Extract repeated string literals (modes, statuses, quadrants) into `lib/constants.ts` with types in `lib/types.ts` — never scatter raw literals across files

## Key Rules

- **Always Bun**: use `bun` / `bunx` for ALL package management, scripts, one-off evals (`bun -e`), and registry queries (`bun info`) — never `npm`, `npx`, `node`, `yarn`, or `pnpm`. Only documented exceptions (need Node's module loader): `npx shadcn@latest add <name>` and the Playwright test *runner* (`npx playwright test`). Playwright browser install still uses `bunx playwright install`.
- **Always Radix for UI primitives**: build interactive UI on Radix (via the unified `radix-ui` package, imported as `import { X as XPrimitive } from 'radix-ui'`) through shadcn wrappers in `components/ui/`. Never hand-roll tooltips, popovers, dropdowns/menus, dialogs, progress bars, switches/toggles, tabs, etc. — add the shadcn component (`npx shadcn@latest add <name>`) or compose the Radix primitive instead.
- All user-facing text in **German**
- Max 200 lines per file — split if exceeded (excludes test files: `*.spec.ts`, `*.test.ts`)
- `NOTES_ROOT` env var points to data directory
- `revalidatePath()` after mutations (skip on `dynamic = 'force-dynamic'` pages — they rebuild every request)
- No database, no experimental Next.js features, no new packages without updating this file
  - Exception: `experimental.proxyClientMaxBodySize` in `next.config.ts` is required to raise Next.js's default 10 MB proxy body buffer so large audio/video attachments (>10 MB) pass through intact.
- When a missing type definition or API is needed, propose installing a proper package — never write manual shims or workarounds when a package exists. Update this file when adding a package.
- Every imported package must be a **direct dependency** in `package.json` — never rely on transitive deps (they break in clean Docker installs)
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
@uiw/react-codemirror @uiw/react-markdown-preview @codemirror/lang-markdown @codemirror/search @codemirror/commands @codemirror/view @codemirror/state
unist-util-visit @types/mdast
@serwist/turbopack serwist
@diffusionstudio/vits-web
@types/bun
@playwright/test
```

- `@diffusionstudio/vits-web` powers **natural neural read-aloud** (Piper/VITS in-browser via its transitive `onnxruntime-web`). Runs in a **Web Worker** (`lib/neuralTts.worker.ts`, driven by `lib/neuralTtsClient.ts`) so the heavy WASM synthesis never blocks the UI thread; `lib/neuralPlayer.ts` chunks the text (`NEURAL_CHUNK_MAX` — whole-note synthesis overruns the model's memory) and pre-synthesizes the next chunk during playback for gapless audio. Voice models download from HuggingFace on first use and cache in OPFS (offline after that); the ONNX/phonemizer WASM load from CDNs (cdnjs/jsdelivr), so neural TTS needs network on first use and falls back to the Web Speech API (`hooks/useSpeech.ts`) when unavailable/offline.
- Its emscripten glue references Node built-ins (`fs`/`path`/`crypto`) in dead Node-only branches. `next.config.ts` `turbopack.resolveAlias` stubs these to `lib/emptyModule.ts` **for the browser bundle only** (`{ browser: … }`), leaving server-side `fs`/`path`/`crypto` untouched — without this the client build fails to resolve `fs`.
