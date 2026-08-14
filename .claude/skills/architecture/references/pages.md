# Architecture — Layout & Pages

Referenz des `architecture` Skills. Geladen bei Änderungen an `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`.

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
