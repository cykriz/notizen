---
description: Reviewt einen Plan (generische Qualität + Next.js-/Projekt-Invarianten) und gibt
  das Ergebnis als EINEN kopierbaren Markdown-Code-Block aus. Optionales Pfad-Argument; ohne
  Argument wird der aktuelle/eingefügte Plan im Chat reviewt.
argument-hint: [plan_pfad]
allowed-tools: Read, Glob, Grep, Skill(architecture), Skill(proxy), Skill(styling), Skill(review)
---

# /plan-review

Reviewt einen Implementierungs-/Arbeitsplan und gibt das Ergebnis **als genau einen
kopierbaren Markdown-Code-Block** aus, damit man es per Copy-Button am Stück übernehmen kann.

## Ablauf

1. **Plan beschaffen**
   - Ist `$ARGUMENTS` nicht leer → als Dateipfad behandeln und mit `Read` einlesen; das ist der
     Review-Input.
   - Sonst → den zuletzt im Chat genannten/eingefügten Plan bzw. den Plan-Mode-Plan als Input nehmen.
   - Ist **gar kein** Plan auffindbar → einmal kurz nachfragen, welcher Plan reviewt werden soll, und stoppen.

2. **Kontext nur bei Bedarf**
   Für die Invarianten-Prüfung darfst du `CLAUDE.md` (Projekt-Konventionen) und die Skills
   `architecture`, `proxy`, `styling` und `review` konsultieren, sowie betroffene Dateien mit
   `Read`/`Glob`/`Grep` gegenchecken. Inhalte **nicht** duplizieren — nur prüfen und darauf verweisen.

3. **Review erstellen** nach dem Template unten.

4. **Als EIN Code-Block direkt im Chat ausgeben** nach der Fence-Regel unten. Außerhalb des Blocks
   **keine** weitere Prosa, **kein** zweiter Code-Block — höchstens eine einzige kurze Zeile davor
   (z.B. „Hier das Review zum Kopieren:").
   - **Niemals eine neue Datei erstellen.** Das Review wird ausschließlich als Code-Block im Chat
     ausgegeben — kein `Write`, kein Speichern in `.md`/`.claude/plans/` o.ä. Nur der zu reviewende
     Plan darf (in Schritt 1) per `Read` eingelesen werden; geschrieben wird nichts.

## Review-Template (= Inhalt des Code-Blocks, in Markdown)

```
# Plan-Review: <kurzer Titel des Plans>

## Gesamturteil
**Freigeben | Überarbeiten | Blockiert** — <Begründung in 1–2 Sätzen>

## Stärken
- <was der Plan gut macht>

## Generische Qualität
- ✅/⚠️/❌ Vollständigkeit & Scope
- ✅/⚠️/❌ Explizite Annahmen benannt
- ✅/⚠️/❌ Schritt-Reihenfolge / Abhängigkeiten klar
- ✅/⚠️/❌ Fehler- & Edge-Cases bedacht
- ✅/⚠️/❌ Verifikation/Tests (Unit: `bun test` mit `bun:test`, `NOTES_ROOT` auf Temp-Dir setzen, reine FS-/Logik-Helfer testen; E2E: `bun run test:e2e` (Playwright); **kein vitest/Jest**; nach jeder Änderung `bun run lint && bunx tsc --noEmit`)
- ✅/⚠️/❌ Rollback / Reversibilität
- ✅/⚠️/❌ Betroffene Dateien konkret benannt

## Notizen-/Projekt-Invarianten (✅/⚠️/❌/n.z.)
(Diese Dimensionen entsprechen denen aus `/review` — der Plan wird damit vorab gegen die spätere Code-Review-Latte gehalten.)
- **Sprache**: alle nutzersichtbaren Texte **Deutsch**; neue wiederkehrende Strings als Konstante, nicht inline verstreut
- **Datei-Limit**: max **200 Zeilen/Datei** (außer `*.test.ts`/`*.spec.ts`) — splittet der Plan zu große Dateien?
- **Konstanten/Typen**: wiederholte Literale (Modes/Status/Quadranten/Messages) → `lib/constants.ts`, Typen in `lib/types.ts` — nicht über Dateien streuen
- **Kein Database**: ausschließlich Dateisystem über `lib/fsNotes.ts`/`lib/fsTodos.ts`/`lib/fsShares.ts`; `NOTES_ROOT` als Wurzel; kein DB-/Cache-Server eingeführt
- **Offline-first (PWA)**: jedes Feature muss **offline** funktionieren; neue Routen/Daten im SW-Caching bedacht (`worker/sw.ts`, `swStrategies.ts`, `swWarm.ts`); kritische Pfade precachen; neue navigierbare Seiten brauchen Offline-Verhalten/Shell
- **Service-Worker-Strategien**: HTML = `networkFirstWithFallback`, `/_next/static/` = `cacheFirst`, API = `networkFirst`, sonst `staleWhileRevalidate`; `/share/`-Routen **nie** cachen; SW-Message-Protokoll (`SW_MSG_CLEAR_AUTH_CACHES`/`SW_MSG_WARM_PAGE_CACHE`) konsistent
- **Auth/Proxy**: neue Routen entweder hinter Auth oder bewusst als Public-Path in `proxy.ts` eingetragen; Session-Cookie-Vertrag (HMAC, 7 Tage) unangetastet; Share-Responses bleiben `private, must-revalidate`
- **Mutations/Revalidation**: `revalidatePath()` nach Mutationen — **außer** auf `dynamic = 'force-dynamic'`-Seiten (z.B. Share-Page)
- **Server Actions / API**: Inputs mit `zod` validieren, Fehlershape `{ error: string }`, Auth-Gate (`requireAuthSession()`); keine sensiblen Daten leaken
- **`'use client'`**: nur wo nötig (State/Hooks/Events); Daten-Fetching bevorzugt serverseitig statt `useEffect`; `useRouter`/`useSearchParams`/`usePathname` nur in Client-Komponenten
- **Styling-Tokens**: nur Tailwind (kein `style={{}}`), **keine** Hardcode-Farben (semantische Tokens), **kein** `dark:`-Prefix, `cn()` nur Objekt-Syntax; shadcn aus `components/ui/` statt rohem HTML; geteilte Klassen → `app/custom-components.css`; neue Farbe in `:root`+`.dark`+`@theme inline`
- **Pakete**: keine neuen Packages ohne Update der Approved-Liste in `CLAUDE.md`; jeder Import = **direkte** Dependency in `package.json` (keine transitiven); keine manuellen Typ-Shims — stattdessen Paket vorschlagen
- **Tags**: hierarchisch, slash-getrennt (`dev/python/fastapi`)
- **Next.js-Config**: keine experimentellen Features außer dem dokumentierten `experimental.proxyClientMaxBodySize`; `output: 'standalone'` bleibt
- **Konventionen**: PascalCase-Komponenten, camelCase-Utils, kebab-case-Routen; seiten-spezifische Komponenten im Route-Ordner; keine toten Imports/auskommentierten Blöcke

## Lücken & Risiken
1. [hoch|mittel|niedrig] <Problem> — Fix: <Vorschlag>

## Offene Fragen
- <was vor der Umsetzung geklärt werden muss>
```

Nicht zutreffende Invarianten als `n.z.` markieren statt weglassen.

## Fence-Regel — KERN-ANFORDERUNG: nur EIN Code-Block

Der Review-Text ist selbst Markdown und enthält **Backtick**-Fences (` ``` `, z.B. um Code-Snippets
im Plan zu zitieren). Würde man ihn in einen Backtick-Block packen, schlösse der erste innere
` ``` `-Lauf den Block vorzeitig. Lösung: den äußeren Block mit **Tilde-Fences (`~~~`)** umschließen.

In CommonMark sind Tilde- und Backtick-Fences **unabhängig**: ein Tilde-Block wird **nur** durch
eine Zeile mit ≥ gleich vielen **Tilden** geschlossen — Backticks im Inhalt schließen ihn **nie**,
egal wie viele. Das ist robuster und einfacher als das Zählen von Backtick-Läufen, weil
Review-Inhalte praktisch nie Tilden-Fences enthalten.

1. Stelle zuerst den **kompletten** Review-Markdown zusammen.
2. Ermittle den **längsten zusammenhängenden Tilden-Lauf N** darin (fast immer 0).
3. Wähle die Fence-Länge **F = max(N + 1, 4)** — Default 4 Tilden, damit auch der seltene Fall eines
   3-Tilden-Laufs im Inhalt sicher umschlossen ist.
4. Gib den **gesamten** Review in genau einem Fence aus: eine Zeile mit F Tilden (optional direkt
   gefolgt von `markdown` als Sprach-Hint), dann der Review, dann eine eigene Zeile mit denselben F
   Tilden. Öffnungs- und Schluss-Fence haben dieselbe Anzahl.

**Niemals Backtick-Fences (` ``` `) für den äußeren Block verwenden** — sonst bricht der erste
innere Code-Fence den Block auf. Der äußere Block ist **immer** ein Tilde-Fence.
