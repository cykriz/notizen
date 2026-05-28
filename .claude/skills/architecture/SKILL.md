---
name: architecture
description: Data model, filesystem layout, API routes, core functions, component inventory, and page structure for the notes app. Use when building new features, adding routes, or understanding how the app fits together.
---

## Data Model

See `lib/types.ts` for full definitions. Key types:

- `NoteSummary` / `Note` — notes with tags, pinned, attachments
- `Todo` — Eisenhower matrix quadrants (`do`, `schedule`, `delegate`, `planned`)
- `Attachment` — file metadata with `relativePath`
- Constants and quadrant metadata live in `lib/constants.ts`

## Filesystem Layout

- Notes: `NOTES_ROOT/notes/YYYY-MM-DD-slug-uuid/note.md` + `attachments/`
- Frontmatter in `note.md`: id, title, tags, pinned, createdAt, updatedAt
- Todos: `NOTES_ROOT/todos.json` (single JSON array)
- Shares: `NOTES_ROOT/.shares/shares.json` (single JSON registry, token → { username, noteId, preset, createdAt, expiresAt })

## Core Functions

- `lib/clearSwCaches.ts` — posts `SW_MSG_CLEAR_AUTH_CACHES` to the active SW (no-op outside browser / without `serviceWorker`)
- `worker/offlineFallback.ts` — last-ditch SW responses (`offlineHtmlResponse`, `offlineDataResponse`) when even `/offline` isn't cached
- `lib/fsNotes.ts` — CRUD for notes (listNotes, getNote, createNote, updateNote, deleteNote); re-exports attachment helpers
- `lib/fsAttachments.ts` — attachment CRUD (listAttachments, saveAttachment, deleteAttachment, getAttachmentFilePath)
- `lib/fsTodos.ts` — CRUD for todos (listTodos, getTodo, createTodo, updateTodo, deleteTodo)
- `lib/tagTree.ts` — hierarchical tag tree (buildTagTree, getChildNodes, getNotesAtPath, getNotesUnderPath, listAllTags, listAllTagPaths)
- `lib/fsHelpers.ts` — shared filesystem helpers
- `lib/schemas.ts` — Zod validation schemas
- `lib/apiHelpers.ts` — API utility helpers
- `lib/tryFetch.ts` — fetch wrapper
- `lib/localCache.ts` — client-side local cache CRUD (notes, todos, sync queue)
- `lib/localCacheMerge.ts` — merge, tombstones, and cache expiry cleanup
- `lib/syncQueue.ts` — offline sync queue management
- `lib/failedSyncQueue.ts` — permanently failed sync entries (exceeded retries / non-retryable)
- `lib/offlineNotes.ts` / `lib/offlineTodos.ts` — offline support for notes and todos
- `lib/offlineTagFolder.ts` — offline tag-folder deletion (deleteTagFolderOffline, stripFolderTags)
- `lib/fsShares.ts` — share registry CRUD (upsertShare, revokeShare, getShare, getShareByNote)
- `lib/fsSharesRegistry.ts` — share registry I/O + locking (read/write, prune, withSharesLock, removeUserShares)
- `lib/fsSharesQuery.ts` — read-side share queries (`listSharesByUsername` returns `UserShareRecord[]`)
- `lib/shareTypes.ts` — `ShareRecord`, `UserShareRecord`, and `SharePresetSchema` (shared by server actions and helpers)
- `lib/shareFormat.ts` — share-link presentation helpers (`formatExpiresAt`, `buildShareUrl`)
- `lib/shareContent.ts` — rewrite attachment URLs in shared note bodies (rewriteAttachmentUrlsForShare)
- `app/(app)/sharedNotesStore.ts` — client store (`refresh`, `upsert`, `removeByNoteId`) for the current user's active shares
- `app/(app)/navTabs.ts` — shared `NAV_TABS` (route + label + icon) and `isTabActive(href, pathname)` used by sidebar header and mobile bottom nav
- `app/(app)/failedSyncTag.ts` — render-time helper `withFailedSyncTag(notes, failedIds)` injects the reserved `FAILED_SYNC_TAG` (`sync-fehler`, see `lib/constants.ts`) onto notes whose sync permanently failed; sidebar-only, never persisted

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

## Layout & Pages

- `app/(app)/layout.tsx` — Server component, fetches notes + todos, SidebarProvider + AppSidebar + SidebarInset
- `app/(app)/notes/page.tsx` — Empty state
- `app/(app)/notes/[id]/page.tsx` — Note editor + attachments
- `app/(app)/todos/page.tsx` — Eisenhower Matrix (2x2 grid)
- `app/offline/page.tsx` — Offline fallback page (top-level, no auth, no sidebar — SW caches and serves this when both network and the user-requested route are unavailable)
- `app/(app)/error.tsx` — Error boundary
- `app/share/[token]/page.tsx` — Public read-only shared note view (no `loading.tsx`: a Suspense boundary would flush 200 headers before `notFound()` could set 404)
- `app/share/layout.tsx`, `app/share/error.tsx`, `app/share/not-found.tsx` — share segment overrides (suppress PWA metadata, render anonymous error / 404 UI)
- Mobile: bottom tab bar via MobileBottomNav (`md:hidden`)

## Key Components

| Component | Location |
|---|---|
| MarkdownEditor | `components/MarkdownEditor.tsx` — `[[` + Cmd+L for note linking |
| MarkdownEditorToolbar | `components/MarkdownEditorToolbar.tsx` — editor toolbar |
| MarkdownPreview | `components/MarkdownPreview.tsx` — rendered markdown view |
| NoteLinkPicker | `components/NoteLinkPicker.tsx` — reusable note search dialog |
| InternalLink | `components/InternalLink.tsx` — internal note link renderer |
| SyncStatusIndicator | `components/SyncStatusIndicator.tsx` — offline sync status |
| AttachmentList | `components/AttachmentList.tsx` — display note attachments |
| FileUpload | `components/FileUpload.tsx` — file upload UI |
| NoteOutline | `components/NoteOutline.tsx` — heading-based outline, shared by editor and share view |
| ThemeToggle | `components/ThemeToggle.tsx` — dark/light theme switch |
| AppSidebar | `app/(app)/AppSidebar.tsx` — sidebar shell, double-click-to-create, swipe-back |
| AppSidebarHeader | `app/(app)/AppSidebarHeader.tsx` — tabs (Notizen/Aufgaben), sync indicator, LogoutButton |
| LogoutButton | `app/(app)/LogoutButton.tsx` — logout submit button; calls `clearSwCaches` before the server action so SW pages cache is purged pre-redirect |
| OfflineReloadButton | `app/offline/OfflineReloadButton.tsx` — client island used by `/offline` for the "Erneut versuchen" reload button |
| NotesSidebarContent | `app/(app)/NotesSidebarContent.tsx` — Tags/Alle toggle and main note list (pinned moved to PinnedNotesGroup) |
| PinnedNotesGroup | `app/(app)/PinnedNotesGroup.tsx` — pinned-notes sidebar group, shown after SharedNotesEntry; caps at 40vh and scrolls internally |
| TodosSidebarContent | `app/(app)/TodosSidebarContent.tsx` — todos sidebar content |
| TagBrowser | `app/(app)/TagBrowser.tsx` — folder-style drill-down |
| DataProvider | `app/(app)/DataProvider.tsx` — client-side data context |
| DeleteNoteDialog | `app/(app)/DeleteNoteDialog.tsx` — note deletion confirmation |
| DeleteTagFolderDialog | `app/(app)/DeleteTagFolderDialog.tsx` — tag folder deletion confirmation |
| ClearFailedSyncDialog | `app/(app)/ClearFailedSyncDialog.tsx` — confirms purge of the failed sync queue; opened from SyncStatusIndicator and from the sync-fehler TagNavigation toolbar |
| NoteListItem | `app/(app)/NoteListItem.tsx` — note list entry |
| MobileBottomNav | `app/(app)/MobileBottomNav.tsx` — bottom tab bar (`md:hidden`) |
| useVisualViewportHeight | `hooks/useVisualViewportHeight.ts` — tracks `window.visualViewport`; sets `--app-h` on `<html>` and toggles `data-keyboard-open` so the app shell shrinks and mobile UI hides when the on-screen keyboard opens |
| useNoteKeyboardShortcuts | `hooks/useNoteKeyboardShortcuts.ts` — Escape / Cmd+O / Cmd+Shift+O shortcuts for the note editor |
| useFocusOnEditMode | `hooks/useFocusOnEditMode.ts` — focuses MarkdownEditor when preview switches to edit |
| useAutoShowOutline | `hooks/useAutoShowOutline.ts` — opens the outline once content overflows the editor viewport |
| ViewportEffects | `app/(app)/ViewportEffects.tsx` — mounts `useVisualViewportHeight` to expose `--app-h` and `data-keyboard-open` for the app shell |
| useTagStateSync | `app/(app)/useTagStateSync.ts` — sidebar tag-path reconciliation (note open, tag edits, palette nav) |
| CommandPalette | `app/(app)/CommandPalette.tsx` — Cmd+P search (@ prefix for tag navigation) |
| tagNavigationStore | `app/(app)/tagNavigationStore.ts` — cross-component tag path navigation |
| CommandPaletteClient | `app/(app)/CommandPaletteClient.tsx` — client-side command palette |
| NoteEditor | `app/(app)/notes/[id]/NoteEditor.tsx` — note editing logic |
| NoteHeader | `app/(app)/notes/[id]/NoteHeader.tsx` — note header component |
| NotePageClient | `app/(app)/notes/[id]/NotePageClient.tsx` — note page client logic |
| TagInput | `app/(app)/notes/[id]/TagInput.tsx` — tag editing with autocomplete |
| TagBadge | `app/(app)/notes/[id]/TagBadge.tsx` — tag display badge |
| ShareNoteButton | `app/(app)/notes/[id]/ShareNoteButton.tsx` — popover to create/revoke share link |
| ShareNoteBody | `app/(app)/notes/[id]/ShareNoteBody.tsx` — share popover body (fetch state, copy link, expiry display, revoke) |
| useShareInfo | `app/(app)/notes/[id]/useShareInfo.ts` — hook orchestrating share state lifecycle (fetch, create, revoke, change preset) |
| SharedNotesEntry | `app/(app)/SharedNotesEntry.tsx` — sidebar entry + badge that opens the shared-notes dialog (online-only, hidden in todos view) |
| SharedNotesDialog | `app/(app)/SharedNotesDialog.tsx` — list dialog for all of a user's active share links (open / copy / revoke) |
| SharedNotesList | `app/(app)/SharedNotesList.tsx` — presentational list rendered inside the dialog |
| sharedNotesStore | `app/(app)/sharedNotesStore.ts` — `useSyncExternalStore` for current user's active shares (refresh, upsert, removeByNoteId) |
| SharedNoteView | `app/share/[token]/SharedNoteView.tsx` — public read-only note renderer |
| EisenhowerMatrix | `app/(app)/todos/EisenhowerMatrix.tsx` — 2x2 grid |
| TodoDialog | `app/(app)/todos/TodoDialog.tsx` — create/edit with note linking |
| QuadrantCard | `app/(app)/todos/QuadrantCard.tsx` — quadrant card |
| TodoCard | `app/(app)/todos/TodoCard.tsx` — individual todo card |
| ClearableDateInput | `app/(app)/todos/ClearableDateInput.tsx` — date input |
| LinkedNotesField | `app/(app)/todos/LinkedNotesField.tsx` — link notes to todos |

## Installed shadcn/ui Components

button, card, input, dialog, textarea, badge, sidebar, separator, sheet, tooltip, skeleton, checkbox, select, command, popover
