---
description: Delegiert den Review aller nicht-committeten Änderungen an den Subagenten `review-changes`
---

Delegiere den Review — **führe ihn nicht selbst aus**. Die Prüflogik liegt bewusst außerhalb des
Hauptkontexts, im Sub-Agenten.

1. **Primärweg.** `Agent`-Tool, `subagent_type: review-changes`, `run_in_background: false`. Beende
   den Turn nicht, bevor der Agent geantwortet hat. Prompt **exakt**:

   > Reviewe alle nicht-committeten Änderungen (untracked, unstaged, staged) in diesem Repo.

   Nichts darüber hinaus — kein Kontext, keine Absicht, keine Zusammenfassung. Der Agent urteilt blind.

2. **Fallback**, und nur dann: der Aufruf schlägt mit unbekanntem `subagent_type` fehl. Die
   Agent-Registry wird beim Session-Start gebaut, ein frisch angelegter Agent greift erst nach einem
   Neustart. Dann **genau ein** Versuch mit `subagent_type: general-purpose` und dem Prompt:

   > Lies `.claude/agents/review-changes.md`; der Body ab der Frontmatter sind DEINE Anweisungen; du
   > bist rein lesend. Reviewe alle nicht-committeten Änderungen (untracked, unstaged, staged) in
   > diesem Repo.

   ⚠️ `general-purpose` **hat** Write/Edit — dort hängt die Read-only-Zusage allein am Prompt.
   Bevorzuge den Primärweg.

3. **Beide Wege gescheitert** → in einer Zeile melden. **Nicht** ersatzweise selbst reviewen.

Was mit dem Befund geschieht, steht in `CLAUDE.md` § "Code Review (automatic)" — Berichts-Kontrakt
und Laufzeit-Gates dort, nicht hier.
