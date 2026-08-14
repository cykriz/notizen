# Architecture — API Routes & Server Actions

Referenz des `architecture` Skills. Geladen bei Änderungen an `app/api/**`, `app/share/**` oder `*Actions.ts`.

## API Routes

```
app/api/notes/route.ts              → GET, POST
app/api/notes/[id]/route.ts         → GET, PUT, DELETE
app/api/notes/[id]/attachments/     → GET, POST
app/api/notes/[id]/attachments/[attId]/ → DELETE
app/api/notes/[id]/attachments/[attId]/download/ → GET
app/api/todos/route.ts              → GET, POST
app/api/todos/[id]/route.ts         → GET, PUT, DELETE
app/api/health/route.ts              → GET
app/api/serwist/[...path]/route.ts   → service worker
```

Public share routes (bypass proxy auth, registered in `proxy.ts` `PUBLIC_PREFIXES`; the proxy also sets `Cache-Control: private, max-age=0, must-revalidate` so revocation/expiry take effect immediately):

```
app/share/[token]/page.tsx                              → GET (read-only note view)
app/share/[token]/attachments/[attId]/route.ts          → GET (read-only attachment download)
```

A valid share token grants read access to the shared note AND every attachment of that note (not only attIds referenced in the markdown body). attIds are 8 hex chars and only resolvable in the context of the share's note — the 256-bit token is the real gate.

- NextRequest/NextResponse, Zod validation on every endpoint
- Error shape: `{ error: string }`

## Server Actions

- `app/(app)/shareActions.ts` — `upsertShareLinkAction(noteId, preset)`, `revokeShareLinkAction(noteId)`, `getShareInfoForNoteAction(noteId)`, `listSharedNotesAction()`. All gated by `requireAuthSession()` and validate inputs with Zod. The share page is `dynamic = 'force-dynamic'`, so no `revalidatePath` is needed.
- Note and todo mutations deliberately have **no** server actions: they must go through the API routes so the offline layer can queue and replay them. A server action would write straight to the filesystem, bypassing the outbox and the tombstones — the exact failure mode that layer exists to prevent.

## Share-Segment

- `app/share/[token]/SharedNoteView.tsx` — public read-only note renderer

Die Segment-Overrides (`app/share/layout.tsx`, `error.tsx`, `not-found.tsx`) und die
`loading.tsx`-Falle der Share-Seite stehen in `references/pages.md`.
