# Architecture — Core Functions

Referenz des `architecture` Skills. Geladen bei Änderungen an `lib/**` oder `worker/**`.
Kuratiert, nicht vollständig — s. `SKILL.md`. Komponenten/Hooks: `references/ui.md`.

## Core Functions

- `lib/utils.ts` — `cn`; `formatDate`/`formatDateTime` (every user-facing date goes through one of these, both pinned to `DISPLAY_TIME_ZONE`); `byUpdatedAtDesc` (the shared newest-first comparator for anything carrying an ISO `updatedAt` — note and todo listings and the WIP surplus rule all sort through it)
- `lib/pathConstants.ts` — route paths several layers must agree on (`NOTES_PATH`, `TODOS_PATH`, `NOTES_PATH_PREFIX`) plus `SW_PRECACHE_PATHS`, the documents the SW must always hold. Owned here, not in `lib/constants.ts` (line cap); consumed by `navTabs`, the worker and the e2e spec
- `lib/globalShortcuts.ts` — `SHORTCUT` (the app's Mod+<key> vocabulary) plus `registerShortcut`, behind the **one** `keydown` listener for all of them. Bound in the **capture** phase on purpose: cmdk and CodeMirror both skip an event whose default is already prevented, so claiming a combo before it reaches them is what stopped Ctrl+P from closing the palette *and* moving its selection (cmdk reads it as "up"), and Mod+O from toggling the preview *and* splitting a line. Unclaimed combos are left untouched, so the browser keeps e.g. Ctrl+O where the app has no handler. Bind through `useGlobalShortcut`, never with a listener of your own
- `lib/swMessage.ts` — the page→SW channel (`postToServiceWorker`, `requestFromServiceWorker` over a MessageChannel, `runWhenIdle`). Addresses the SW via `serviceWorker.ready` → `registration.active`, **not** `controller`, so it also reaches the SW from the page that just installed it (first load after a deploy)
- `lib/ensurePrecache.ts` — asks the SW to verify + repair its precache and warns when a gap survives. Called from `DataProvider` on mount and on every online edge, the only context guaranteed to hold a session (the SW's own install fetches get a 307 to /login without one)
- `lib/clearSwCaches.ts` — `clearSwCaches` posts `SW_MSG_CLEAR_AUTH_CACHES` synchronously via `controller` (the logout button submits a form in the same tick, so an await could die with the document); `clearSwCachesWhenReady` is the `serviceWorker.ready` catch-up used on the /login mount, where nothing is navigating and `controller` may still be null
- `worker/sw.ts` — the SW entry point: fetch/message routing. Wires the strategies from `swStrategies`, `ensurePrecached` from `swPrecache` and `cacheNavigationHtml` from `swWarm`; handles `SW_MSG_CLEAR_AUTH_CACHES` / `SW_MSG_ENSURE_PRECACHE` / `SW_MSG_WARM_PAGE_CACHE`, bypasses `SW_BYPASS_API_PREFIXES`, never caches `SHARE_PATH_PREFIX`
- `worker/swStrategies.ts` — `cacheFirst`, `networkFirst`, `networkFirstWithFallback`, `staleWhileRevalidate`, plus `CACHE`, `shouldCacheNavigation`, `trimCache` and the caps (`PAGES_CACHE_MAX` 100, `API_CACHE_MAX` 20, `MISC_CACHE_MAX` 50, `API_CACHE_MAX_BYTES` 5 MB). `pages-`/`static-` are versioned by `SW_BUILD_ID` and the activate sweep evicts the previous build — **that** is what bounds `static`, which has no FIFO trim
- `worker/swWarm.ts` — `cacheNavigationHtml` warms the pages cache with the genuine HTML (callers: the client via `SW_MSG_WARM_PAGE_CACHE` after a note open, and `ensurePrecached()`); `ensureStaticAssets` warms the `/_next/static/chunks|css` referenced by that HTML so an offline cold-load can hydrate. The allowlist is note detail pages **plus** the precache set — without the second clause `/offline`, `/notes` and `/todos` are unreachable for every warm path
- `worker/swPrecache.ts` — `ensurePrecached()`: which of `SW_PRECACHE_PATHS` / build assets are missing, refill only those, report what's left. One shared in-flight run; the slot is released on settle so later calls re-check
- `worker/offlineFallback.ts` — last-ditch SW responses (`offlineHtmlResponse`, `offlineDataResponse`) when even `/offline` isn't cached
- `lib/fsNotes.ts` — CRUD for notes (listNotes, getNote, createNote, updateNote, deleteNote); re-exports attachment helpers
- `lib/fsAttachments.ts` — attachment CRUD (listAttachments, saveAttachment, deleteAttachment, getAttachmentFilePath)
- `lib/fsTodos.ts` — CRUD for todos (listTodos, getTodo, createTodo, updateTodo, deleteTodo)
- `lib/fsTodosStore.ts` — the `todos.json` read/write layer under `fsTodos`; normalises quadrants **and** caps "Erledigen" at `DO_LIMIT` on read, so the fix is persisted by the next write
- `lib/quadrantAlias.ts` — `toUsableQuadrant`: the single rule for what a stored quadrant means. Retired values (pre-`cd9392c` `delegate`; the merged-away `schedule`/`planned`) are rewritten, anything else unrecognised falls back to Eingang rather than being dropped. Applied at BOTH entry points (`fsTodosStore` for `todos.json`, `schemas` for caches and responses), which is why per-quadrant records can be indexed directly
- `lib/tagTree.ts` — hierarchical tag tree (buildTagTree, getChildNodes, getNotesAtPath, getNotesUnderPath, listAllTags, listAllTagPaths) plus the pure path-string helpers (normalizeTagPath, `isCreatableTagPath` — the one rule for whether a normalized path may be written as a tag, shared by TagInput, CreateTagFolderDialog and the palette's create row — parentTagPath, ancestorTagPaths, leafTagSegment) and the folder-tag rewriters (replaceFolderTag, moveNoteToFolder)
- `lib/fsHelpers.ts` — shared filesystem helpers
- `lib/schemas.ts` — Zod schemas plus the row-wise parsers. Two variants with different contracts: the lenient `parse*Rows` for cache reads (salvage what is readable), and the strict `parse*RowsStrict` for server responses, where **`null` means the caller MUST skip the merge** — `[]` would be read as "the server has nothing" and wipe the offline cache
- `lib/apiHelpers.ts` — API utility helpers
- `lib/tryFetch.ts` — fetch wrapper
- `lib/commandSearch.ts` — ranking for the command palette and note picker (rankByQuery, noteSearchText, sortNotesForPalette) plus `tagCreateCandidate`, the `@`-mode derivation of "which tag would this query create, if any" (null for an unwritable or already existing path — the exists check needs no prefix logic because listAllTagPaths carries every intermediate folder under its own path). Both callers pass cmdk `shouldFilter: false` and rank here instead, because cmdk scores the CommandItem `value` — the note id — as part of the haystack, so a UUID both matched hex-only queries in every note and outscored real titles. Ranking here also means React owns the row order, instead of cmdk re-appending rows in the DOM
- `lib/localCache.ts` — client-side local cache CRUD (notes, todos, sync queue)
- `lib/localCacheMerge.ts` — merge, tombstones, and cache expiry cleanup. Failed sync entries deliberately never expire: they are the only record of unsynced content, and they are what keeps `notizen:note:<id>` + drafts + the list keys out of the TTL sweep
- `lib/syncQueue.ts` — offline sync queue management (`enqueueMutation`, `processSyncQueue`, `requeueFailedEntry`)
- `lib/syncReplay.ts` — replays one queued mutation; returns `ReplayResult` carrying the HTTP status + trimmed body so the failure can be recorded. Also owns `classifyErrorResponse`, the single rule for what a non-ok answer means (retry vs. give up, DELETE + 404 = done) — shared with the direct write path so the two can never disagree
- `lib/todoColumns.ts` — the board's column model: `TODO_COLUMN`/`TODO_COLUMN_META`, `columnOf` (Erledigt is derived from `completed`, never stored), `canEnterDo` (the single WIP rule, called by all five ways into Erledigen) and `enforceDoLimit` (the migration/last-resort cap, hung into `fsTodosStore` only)
- `lib/syncQueuePayload.ts` — pure payload algebra for the queues: `foldQueuedEntry` merges partial UPDATEs instead of replacing them (offline drag + tick used to lose the quadrant), `subtractAckedKeys` clears only the fields a successful write actually carried, so a failed change for *other* fields keeps its inspector row
- `lib/offlineWrite.ts` — `sendOrQueue`: the one send-or-enqueue decision for notes and todos (eligibility, `X-Expected-UpdatedAt` + one-shot 409 re-send, deterministic 4xx straight to the inspector, everything else queued). Also `deleteEntityOffline`, the shared optimistic-delete path
- `lib/offlineAdopt.ts` — `upsertById`: replace-or-insert by id, the shared half of adopting a server response. Callers pass the CURRENT cache, never the list captured when the write started, so a slower in-flight write cannot undo a faster one
- `lib/failedSyncQueue.ts` — permanently failed sync entries (exceeded retries / non-retryable). `markFailure` stamps `SyncFailureInfo` onto the entry; failures are also written onto the *pending* entry during retries so a max-retries give-up still knows the real status. `getInspectableEntries` adds pending entries marked `not-recorded` (localStorage full — they stay pending as the surviving record)
- `lib/failedSyncDiscard.ts` — `discardEntry` / `discardAllEntries`: drops the entry AND the local state it would otherwise resurrect (cached list row always; `notizen:note:<id>` + draft only when the change carried content). Never adds a tombstone
- `lib/failedSyncDetail.ts` + `lib/failedSyncCause.ts` + `lib/failedSyncPayload.ts` — pure view model for the inspector (`toFailedSyncDetails` takes injected `sources`, so it unit-tests without a DOM). Defensive readers guard both `payload` and `failure`, which come from an unvalidated cast
- `lib/failedSyncConstants.ts` — German strings for the inspector (`lib/constants.ts` is at its line cap)
- `lib/syncStatusConstants.ts` — German strings for the sidebar sync indicator (same reason)
- `lib/tagConstants.ts` — German strings for the sidebar tag navigation, the palette's tag mode and `CreateTagFolderDialog` (same reason); most are the accessible names the e2e tests locate by, exceptions are marked. `folderPathHint` is the odd one: the dialog renders the prefix plus a `font-mono` span, so only the e2e locator needs the assembled string
- `lib/ttsTypes.ts` — read-aloud types (`SpeechControls`, `NeuralSpeechControls`, `ReadAloudState`, `TtsEngine`). Split out of `lib/types.ts` **not** for the line cap but because `SpeechControls` names `SpeechSynthesisVoice`: `lib/types.ts` is reachable from `worker/`, which is type-checked with `lib: webworker` and no `dom`. Keep DOM-typed shapes out of `lib/types.ts`
- `lib/offlineNotes.ts` / `lib/offlineTodos.ts` — offline support for notes and todos. Both are thin over `sendOrQueue`; each keeps only its own cache adoption (`adoptServer*` writes the server row over the optimistic one, rebuilt from the CURRENT cache so a slower in-flight write cannot undo a faster one)
- `lib/offlineTagFolder.ts` — offline tag-folder deletion (deleteTagFolderOffline, stripFolderTags)
- `lib/offlineAttachments.ts` — local reconciliation after an attachment POST/DELETE (`applyAttachmentChange` pure for `setNotes(prev => …)`, `cacheAttachmentChange` for both localStorage entries). Attachments never enter the sync queue and never touch `note.md`/`updatedAt`, so no save and no revalidate carries the new `attachmentCount` into the sidebar
- `lib/fsShares.ts` — share registry CRUD (upsertShare, revokeShare, getShare, getShareByNote)
- `lib/fsSharesRegistry.ts` — share registry I/O + locking (read/write, prune, withSharesLock, removeUserShares)
- `lib/fsSharesQuery.ts` — read-side share queries (`listSharesByUsername` returns `UserShareRecord[]`)
- `lib/shareTypes.ts` — `ShareRecord`, `UserShareRecord`, and `SharePresetSchema` (shared by server actions and helpers)
- `lib/shareFormat.ts` — share-link presentation helpers (`formatExpiresAt`, `buildShareUrl`)
- `lib/shareContent.ts` — rewrite attachment URLs in shared note bodies (rewriteAttachmentUrlsForShare)
- `app/(app)/navTabs.ts` — shared `NAV_TABS` (route + label + icon) and `isTabActive(href, pathname)` used by sidebar header and mobile bottom nav
- `app/(app)/failedSyncTag.ts` — render-time helper `withFailedSyncTag(notes, failedIds)` injects the reserved `FAILED_SYNC_TAG` (`sync-fehler`, see `lib/constants.ts`) onto notes whose sync permanently failed; sidebar-only, never persisted

### Helfer für TTS und Client-Storage

Konsumiert von `components/ReadAloudControls.tsx`, `hooks/useSpeech.ts`, `hooks/useSpeechVoices.ts` —
die liegen in `references/ui.md`.

- `lib/markdownToPlainText.ts` — markdown→plain text + sentence chunking for TTS
- `lib/selectGermanVoice.ts` — rank/select natural German system voices
- `lib/localStorageState.ts` — safe localStorage read/write helper
