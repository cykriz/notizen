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

## Core Functions

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

- NextRequest/NextResponse, Zod validation on every endpoint
- Error shape: `{ error: string }`

## Layout & Pages

- `app/(app)/layout.tsx` — Server component, fetches notes + todos, SidebarProvider + AppSidebar + SidebarInset
- `app/(app)/notes/page.tsx` — Empty state
- `app/(app)/notes/[id]/page.tsx` — Note editor + attachments
- `app/(app)/todos/page.tsx` — Eisenhower Matrix (2x2 grid)
- `app/(app)/offline/page.tsx` — Offline fallback page
- `app/(app)/error.tsx` — Error boundary
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
| ThemeToggle | `components/ThemeToggle.tsx` — dark/light theme switch |
| AppSidebar | `app/(app)/AppSidebar.tsx` — tabs for Notizen/Aufgaben |
| NotesSidebarContent | `app/(app)/NotesSidebarContent.tsx` — pinned + Tags/Alle toggle |
| TodosSidebarContent | `app/(app)/TodosSidebarContent.tsx` — todos sidebar content |
| TagBrowser | `app/(app)/TagBrowser.tsx` — folder-style drill-down |
| DataProvider | `app/(app)/DataProvider.tsx` — client-side data context |
| DeleteNoteDialog | `app/(app)/DeleteNoteDialog.tsx` — note deletion confirmation |
| DeleteTagFolderDialog | `app/(app)/DeleteTagFolderDialog.tsx` — tag folder deletion confirmation |
| NoteListItem | `app/(app)/NoteListItem.tsx` — note list entry |
| MobileBottomNav | `app/(app)/MobileBottomNav.tsx` — bottom tab bar (`md:hidden`) |
| CommandPalette | `app/(app)/CommandPalette.tsx` — Cmd+P search (@ prefix for tag navigation) |
| tagNavigationStore | `app/(app)/tagNavigationStore.ts` — cross-component tag path navigation |
| CommandPaletteClient | `app/(app)/CommandPaletteClient.tsx` — client-side command palette |
| NoteEditor | `app/(app)/notes/[id]/NoteEditor.tsx` — note editing logic |
| NoteHeader | `app/(app)/notes/[id]/NoteHeader.tsx` — note header component |
| NoteOutline | `app/(app)/notes/[id]/NoteOutline.tsx` — note outline/structure |
| NotePageClient | `app/(app)/notes/[id]/NotePageClient.tsx` — note page client logic |
| TagInput | `app/(app)/notes/[id]/TagInput.tsx` — tag editing with autocomplete |
| TagBadge | `app/(app)/notes/[id]/TagBadge.tsx` — tag display badge |
| EisenhowerMatrix | `app/(app)/todos/EisenhowerMatrix.tsx` — 2x2 grid |
| TodoDialog | `app/(app)/todos/TodoDialog.tsx` — create/edit with note linking |
| QuadrantCard | `app/(app)/todos/QuadrantCard.tsx` — quadrant card |
| TodoCard | `app/(app)/todos/TodoCard.tsx` — individual todo card |
| ClearableDateInput | `app/(app)/todos/ClearableDateInput.tsx` — date input |
| LinkedNotesField | `app/(app)/todos/LinkedNotesField.tsx` — link notes to todos |

## Installed shadcn/ui Components

button, card, input, dialog, textarea, badge, sidebar, separator, sheet, tooltip, skeleton, checkbox, select, command
