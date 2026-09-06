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
| NoteCommandItem | `components/NoteCommandItem.tsx` — one note row in a cmdk list, shared by NoteLinkPicker and CommandPalette |
| InternalLink | `components/InternalLink.tsx` — internal note link renderer |
| SyncStatusIndicator | `components/SyncStatusIndicator.tsx` — offline sync status |
| AttachmentList | `components/AttachmentList.tsx` — display note attachments |
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
| TagNavigation | `app/(app)/TagNavigation.tsx` — tag drill-down list, drag-to-move onto folders; renders TagBreadcrumb. Its ringed panel IS the boundary to whatever sits above, so the preceding block (PinnedNotesGroup, else SharedNotesEntry) drops its `separator` — decided in `useSidebarChrome`, which therefore also derives this panel's `childNodes` |
| TagBreadcrumb | `app/(app)/TagBreadcrumb.tsx` — the current folder's name plus its action. A 16rem sidebar cannot hold the path and a readable folder name at once, so the row shows only the leaf (full width, `title` carries the whole path) and the back button carries the path: with two or more targets (`ChevronsLeft`) it opens a Popover listing root + every ancestor for a direct jump, one level below root (`ChevronLeft`, root the only target) it jumps there itself instead of showing a one-row menu; rows are `h-11` below `md` for touch |
| TagFolderIcon | `app/(app)/TagFolderIcon.tsx` — the icon of a tag-navigation row, shared by TagNavigation and CommandPalette's tag mode. Same icon for every row regardless of sub-tags; rationale in the file's header comment |
| DataProvider | `app/(app)/DataProvider.tsx` — client-side data context |
| DeleteNoteDialog | `app/(app)/DeleteNoteDialog.tsx` — note deletion confirmation |
| DeleteTagFolderDialog | `app/(app)/DeleteTagFolderDialog.tsx` — tag folder deletion confirmation |
| FailedSyncDialog | `app/(app)/FailedSyncDialog.tsx` — the failed-sync inspector: lists every failed entry with title, folder, storage location, cause and content, plus per-entry open/retry/copy/discard. Owns the two-step "Alle verwerfen" confirmation in its footer (`FailedSyncFooter`), so there is no separate confirm dialog. Rows in `FailedSyncRow` / `FailedSyncRowDetails`, data via `useFailedSyncDetails`. Opened from SyncStatusIndicator (also while offline) and from the sync-fehler TagNavigation toolbar |
| NoteListItem | `app/(app)/NoteListItem.tsx` — note list entry |
| MobileBottomNav | `app/(app)/MobileBottomNav.tsx` — bottom tab bar with the round search button between the two tabs, the only pointer-driven way into the palette (`paletteStore.set(true)`). `lg:hidden`, not `md:hidden`: that is where `useIsMobile` and the Sheet sidebar switch over, so between 768 and 1023px the bar used to be gone with nothing in its place |
| useVisualViewportHeight | `hooks/useVisualViewportHeight.ts` — tracks `window.visualViewport`; sets `--app-h` on `<html>` and toggles `data-keyboard-open` so the app shell shrinks and mobile UI hides when the on-screen keyboard opens |
| useNoteKeyboardShortcuts | `hooks/useNoteKeyboardShortcuts.ts` — the note editor's Escape (two-stage: leave edit mode, else offer to delete an untitled note) plus Mod+O / Mod+Shift+O via `useGlobalShortcut`. Escape keeps its own bubble-phase listener: it is no Mod combo, and its `preventDefault` is what `useNoteSelection` reads to see the key was consumed |
| useGlobalShortcut | `hooks/useGlobalShortcut.ts` — binds one of the combos in `lib/globalShortcuts.ts` for a component's lifetime; the only sanctioned way to add a global Mod shortcut. Reads the handler through a ref, so an inline closure sees the current render and re-registration is limited to a changed combo. Cannot bridge the mount: whatever must survive a page load has to be bound from a statically imported component, as `CommandPaletteClient` does |
| useFocusOnEditMode | `hooks/useFocusOnEditMode.ts` — focuses MarkdownEditor when preview switches to edit |
| useAutoShowOutline | `hooks/useAutoShowOutline.ts` — opens the outline once content overflows the editor viewport |
| ViewportEffects | `app/(app)/ViewportEffects.tsx` — mounts `useVisualViewportHeight` to expose `--app-h` and `data-keyboard-open` for the app shell |
| useTagStateSync | `app/(app)/useTagStateSync.ts` — sidebar tag-path reconciliation (note open, tag edits, palette nav) |
| useSyncDrain | `hooks/useSyncDrain.ts` — the two outbox drain paths: `syncNow` (user-initiated, pushes then pulls, rejects when the outbox is not empty afterwards) and `syncPending` (fired after every mutation, arms the retry loop, never pulls on its own). `useDataSync`'s backoff effect calls the same `drain`, so manual and automatic cannot drift. Also returns `syncFailedState` (re-reads the failed queue, guarded version bump), which `useDataSync` calls from its mount effect — both queue counts are seeded there rather than in the state initializers |
| useTodoActions | `app/(app)/useTodoActions.ts` — the three todo mutations, split out of DataProvider; each writes through the offline layer, never a server action |
| useSidebarChrome | `app/(app)/useSidebarChrome.ts` — pinned rows, tag folders and `hasTagNav` for AppSidebar. Both lists are derived here, not inside the components that render them, because their emptiness also decides which block drops its separator above the tag navigator |
| useFailedEntityIds | `app/(app)/useFailedEntityIds.ts` — failed-sync ids for one entity type, shared by the sidebar tag and the todo cards. Memo keyed on `failedSyncVersion`, which localStorage cannot signal on its own. Empty until mounted — see `useClientMounted` |
| useClientMounted | `hooks/useClientMounted.ts` — false during SSR *and* the hydration render, true after. Carries the canonical write-up of the rule it exists for: nothing derived from `localStorage`, the clock or `next-themes` may reach the hydration render (React #418), and which of the two shapes — gate a derived value vs. seed SSR-neutral state and correct it in a mount effect — applies where. Other sites point here instead of restating it |
| useColorMode | `hooks/useColorMode.ts` — `resolvedTheme`, but never before the mount; takes the pre-mount fallback so callers match their own surrounding markup (`MarkdownEditor` 'dark', `SharedNoteView` 'light'). Exists because both had a private copy of the expression and one call site forgot to use it |
| CommandPalette | `app/(app)/CommandPalette.tsx` — the search dialog (@ prefix for tag navigation, and for creating a tag that does not exist yet — `createTagFolder` from `useCreateNote`, plus a `/notes` push so an offline create is visible at all). Controlled: `open` and the Mod+P binding belong to `CommandPaletteClient`. The query and the ranking sit in an inner `CommandPaletteContent` that Radix mounts only while the dialog is open, so closing discards the search by unmounting — the same split as `NoteLinkPickerContent`, and for the same reason: `open` is flipped directly — by Mod+P and by the bottom bar's search button — without ever passing through `onOpenChange`, so no close handler sees every way out. Anchored to the top below `lg` so the on-screen keyboard cannot cover the result list |
| CommandPaletteTags | `app/(app)/CommandPaletteTags.tsx` — the palette's `@` mode: the ranked tag rows plus the create row below them. Below, not above, on purpose: cmdk preselects the first row, so Enter has to keep hitting the best existing tag (`@arb` still jumps to `arbeit`) and the create row inherits the preselection exactly when nothing matches. Its whole `CommandGroup` is conditional — with filtering off cmdk would leave an empty group's heading standing |
| tagNavigationStore | `app/(app)/tagNavigationStore.ts` — cross-component tag path navigation |
| paletteStore | `app/(app)/paletteStore.ts` — `open` of the command palette. A store because its two owners, `CommandPaletteClient` (Mod+P) and `MobileBottomNav` (search button), are siblings under a server component; carries why it is not built on a shared store factory |
| CommandPaletteClient | `app/(app)/CommandPaletteClient.tsx` — loads the palette via `dynamic(ssr:false)` and binds Mod+P; `open` itself lives in `paletteStore`. The binding is out here because this file is in the layout's static bundle while the dialog's chunk is fetched only after hydration — binding the shortcut inside it swallowed the first press after every page load. The bottom bar's search button is in the same static bundle and inherits that guarantee |
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
| TodoBoard | `app/(app)/todos/TodoBoard.tsx` — 3-column grid |
| TodoDialog | `app/(app)/todos/TodoDialog.tsx` — create/edit with note linking |
| TodoColumn | `app/(app)/todos/TodoColumn.tsx` — one board column |
| TodoRules | `app/(app)/todos/TodoRules.tsx` — collapsed house rules; self-contained so it can be deleted in two steps |
| todoColumnStyles | `app/(app)/todos/todoColumnStyles.ts` — `todoColumns` metadata + per-column token classes, split out of TodoColumn |
| TodoCard | `app/(app)/todos/TodoCard.tsx` — individual todo card; carries the failed-sync badge, since todos have no sidebar folder to mark |
| LinkedNotesField | `app/(app)/todos/LinkedNotesField.tsx` — link notes to todos |

## Installed shadcn/ui Components

button, card, input, dialog, textarea, badge, sidebar, separator, sheet, tooltip, skeleton, checkbox, select, command, popover, label, progress, collapsible

`collapsible` is hand-written against the unified `radix-ui` package (like every
other wrapper here) rather than added via `npx shadcn@latest add` — that would
pull in a separate `@radix-ui/react-collapsible` dependency.
