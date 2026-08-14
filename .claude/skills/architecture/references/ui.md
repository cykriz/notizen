# Architecture — Components, Hooks & shadcn

Referenz des `architecture` Skills. Geladen bei Änderungen an `components/**`, `hooks/**` oder Client-Komponenten unter `app/(app)/**`.
Kuratiert, nicht vollständig — s. `SKILL.md`.

Von hier mitbenutzt, aber nach Pfadklasse anderswo inventarisiert:

- TTS-/Storage-Helfer `lib/markdownToPlainText.ts`, `lib/selectGermanVoice.ts`, `lib/localStorageState.ts` → `references/core.md`
- `app/share/[token]/SharedNoteView.tsx` (Renderer der öffentlichen Share-Seite) → `references/routes.md`

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
| TagNavigation | `app/(app)/TagNavigation.tsx` — tag drill-down list, drag-to-move onto folders; renders TagBreadcrumb |
| TagBreadcrumb | `app/(app)/TagBreadcrumb.tsx` — the current folder's name plus its action. A 16rem sidebar cannot hold the path and a readable folder name at once, so the row shows only the leaf (full width, `title` carries the whole path) and the back button opens a Popover listing root + every ancestor for a direct jump; rows are `h-11` below `md` for touch |
| DataProvider | `app/(app)/DataProvider.tsx` — client-side data context |
| DeleteNoteDialog | `app/(app)/DeleteNoteDialog.tsx` — note deletion confirmation |
| DeleteTagFolderDialog | `app/(app)/DeleteTagFolderDialog.tsx` — tag folder deletion confirmation |
| FailedSyncDialog | `app/(app)/FailedSyncDialog.tsx` — the failed-sync inspector: lists every failed entry with title, folder, storage location, cause and content, plus per-entry open/retry/copy/discard. Owns the two-step "Alle verwerfen" confirmation in its footer (`FailedSyncFooter`), so there is no separate confirm dialog. Rows in `FailedSyncRow` / `FailedSyncRowDetails`, data via `useFailedSyncDetails`. Opened from SyncStatusIndicator (also while offline) and from the sync-fehler TagNavigation toolbar |
| NoteListItem | `app/(app)/NoteListItem.tsx` — note list entry |
| MobileBottomNav | `app/(app)/MobileBottomNav.tsx` — bottom tab bar (`md:hidden`) |
| useVisualViewportHeight | `hooks/useVisualViewportHeight.ts` — tracks `window.visualViewport`; sets `--app-h` on `<html>` and toggles `data-keyboard-open` so the app shell shrinks and mobile UI hides when the on-screen keyboard opens |
| useNoteKeyboardShortcuts | `hooks/useNoteKeyboardShortcuts.ts` — Escape / Cmd+O / Cmd+Shift+O shortcuts for the note editor |
| useFocusOnEditMode | `hooks/useFocusOnEditMode.ts` — focuses MarkdownEditor when preview switches to edit |
| useAutoShowOutline | `hooks/useAutoShowOutline.ts` — opens the outline once content overflows the editor viewport |
| ViewportEffects | `app/(app)/ViewportEffects.tsx` — mounts `useVisualViewportHeight` to expose `--app-h` and `data-keyboard-open` for the app shell |
| useTagStateSync | `app/(app)/useTagStateSync.ts` — sidebar tag-path reconciliation (note open, tag edits, palette nav) |
| useSyncDrain | `hooks/useSyncDrain.ts` — the two outbox drain paths: `syncNow` (user-initiated, pushes then pulls, rejects when the outbox is not empty afterwards) and `syncPending` (fired after every mutation, arms the retry loop, never pulls on its own). `useDataSync`'s backoff effect calls the same `drain`, so manual and automatic cannot drift. Also returns `syncFailedState` (re-reads the failed queue, guarded version bump), which `useDataSync` calls from its mount effect — both queue counts are seeded there rather than in the state initializers |
| useTodoActions | `app/(app)/useTodoActions.ts` — the three todo mutations, split out of DataProvider; each writes through the offline layer, never a server action |
| useFailedEntityIds | `app/(app)/useFailedEntityIds.ts` — failed-sync ids for one entity type, shared by the sidebar tag and the todo cards. Memo keyed on `failedSyncVersion`, which localStorage cannot signal on its own. Empty until mounted — see `useClientMounted` |
| useClientMounted | `hooks/useClientMounted.ts` — false during SSR *and* the hydration render, true after. Carries the canonical write-up of the rule it exists for: nothing derived from `localStorage`, the clock or `next-themes` may reach the hydration render (React #418), and which of the two shapes — gate a derived value vs. seed SSR-neutral state and correct it in a mount effect — applies where. Other sites point here instead of restating it |
| useColorMode | `hooks/useColorMode.ts` — `resolvedTheme`, but never before the mount; takes the pre-mount fallback so callers match their own surrounding markup (`MarkdownEditor` 'dark', `SharedNoteView` 'light'). Exists because both had a private copy of the expression and one call site forgot to use it |
| CommandPalette | `app/(app)/CommandPalette.tsx` — Cmd+P search (@ prefix for tag navigation) |
| tagNavigationStore | `app/(app)/tagNavigationStore.ts` — cross-component tag path navigation |
| CommandPaletteClient | `app/(app)/CommandPaletteClient.tsx` — client-side command palette |
| NoteEditor | `app/(app)/notes/[id]/NoteEditor.tsx` — note editing logic |
| NoteHeader | `app/(app)/notes/[id]/NoteHeader.tsx` — note header component |
| NotePageClient | `app/(app)/notes/[id]/NotePageClient.tsx` — note page client logic |
| TagInput | `app/(app)/notes/[id]/TagInput.tsx` — tag editing with autocomplete |
| TagBadge | `app/(app)/notes/[id]/TagBadge.tsx` — tag display badge |
| NoteActionsMenu | `app/(app)/notes/[id]/NoteActionsMenu.tsx` — ⋯ popover in the note header (attachment upload, share, tags on mobile); two-view menu ⇄ share |
| ShareMenuView | `app/(app)/notes/[id]/ShareMenuView.tsx` — share panel inside the actions menu (expiry select + ShareNoteBody), wraps useShareInfo |
| ShareNoteBody | `app/(app)/notes/[id]/ShareNoteBody.tsx` — share panel body (fetch state, copy link, expiry display, revoke); rendered inside ShareMenuView |
| useShareInfo | `app/(app)/notes/[id]/useShareInfo.ts` — hook orchestrating share state lifecycle (fetch, create, revoke, change preset) |
| ReadAloudControls | `components/ReadAloudControls.tsx` — speaker popover, shared by editor + share view; orchestrates system/neural TTS with auto-fallback |
| ReadAloudPanel | `components/ReadAloudPanel.tsx` — read-aloud popover body (transport, engine + voice pickers, progress/notice) |
| useSpeech | `hooks/useSpeech.ts` — Web Speech (system) engine: chunked utterances, keep-alive, rate |
| useSpeechVoices | `hooks/useSpeechVoices.ts` — German system-voice list + persisted choice |
| useNeuralSpeech | `hooks/useNeuralSpeech.ts` — Piper/vits-web neural engine (single-shot synth, OPFS model cache) |
| useAttachmentUpload | `hooks/useAttachmentUpload.ts` — note attachment upload flow (hidden input + progress) |
| SharedNotesEntry | `app/(app)/SharedNotesEntry.tsx` — sidebar entry + badge that opens the shared-notes dialog (online-only, hidden in todos view) |
| SharedNotesDialog | `app/(app)/SharedNotesDialog.tsx` — list dialog for all of a user's active share links (open / copy / revoke) |
| SharedNotesList | `app/(app)/SharedNotesList.tsx` — presentational list rendered inside the dialog |
| sharedNotesStore | `app/(app)/sharedNotesStore.ts` — `useSyncExternalStore` for current user's active shares (`refresh`, `upsert`, `removeByNoteId`) |
| EisenhowerMatrix | `app/(app)/todos/EisenhowerMatrix.tsx` — 2x2 grid |
| TodoDialog | `app/(app)/todos/TodoDialog.tsx` — create/edit with note linking |
| QuadrantCard | `app/(app)/todos/QuadrantCard.tsx` — quadrant card |
| quadrantStyles | `app/(app)/todos/quadrantStyles.ts` — `quadrants` metadata + per-quadrant token classes, split out of QuadrantCard |
| TodoCard | `app/(app)/todos/TodoCard.tsx` — individual todo card; carries the failed-sync badge, since todos have no sidebar folder to mark |
| ClearableDateInput | `app/(app)/todos/ClearableDateInput.tsx` — date input |
| LinkedNotesField | `app/(app)/todos/LinkedNotesField.tsx` — link notes to todos |

## Installed shadcn/ui Components

button, card, input, dialog, textarea, badge, sidebar, separator, sheet, tooltip, skeleton, checkbox, select, command, popover, label, progress, collapsible

`collapsible` is hand-written against the unified `radix-ui` package (like every
other wrapper here) rather than added via `npx shadcn@latest add` — that would
pull in a separate `@radix-ui/react-collapsible` dependency.
