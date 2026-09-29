# Duplication Probes

§ "Step 1" of the review checks; the other sections and the floors that grade these probes live in
`checks.md` (§ "Severity Floors"). This heading title is load-bearing — `.claude/plan-review-criteria.md`
applies it by reference, so rename it only together with that file, in the same edit.

## Step 1 — Duplication Sweep (mandatory)

Noticing duplication while reading the diff does not count. Run these six probes explicitly. Each has
a known failure mode that reading top-to-bottom does not catch, because the two copies are never
adjacent.

**1. The extraction probe — both directions.** Three triggers: a file added, a block removed, or a
change that introduces a shared helper or derives a new concept from existing fields.

For every added file, and every file whose diff removes a block: find where that code came from and
confirm the original is gone. A refactor that adds the new home but leaves the old copy in place is the
most common duplication in a diff, and it always looks clean in the diff itself — you only see the
addition. Tells: a comment saying "split out of", "extracted from", "moved to", or a new module whose
exports mirror something already in the file it was carved out of. Open both and compare the bodies line
by line.

Now run it the other way: when the change introduces a shared helper, grep for **every** existing copy
and confirm each one calls it. Converting one call site and leaving a byte-identical sibling standing
parks the new helper next to the duplicate it was meant to retire. "…and the remaining call sites
follow" names none of them and is not a conversion.

The same question applies when the change **derives a new concept from existing fields** (a column from
`completed` + `quadrant`, a state from two flags): grep every read *and* write of the source fields and
say per site whether it moves to the derived concept or stays. The forgotten ones are never the obvious
reads — DataTransfer and queue payloads, cache keys, sort comparators, test fixtures. Each un-migrated
reader is a second answer to the question the derived concept was introduced to answer.

**2. The sibling probe.** Code that comes in sets rarely gets changed evenly. Read the siblings side
by side, never one after the other:

- entity pairs (`notes` ↔ `todos`, `lib/offlineNotes.ts` ↔ `lib/offlineTodos.ts`)
- verb sets (`create` / `update` / `delete`, `get` / `set`, `read` / `write`)
- transport pairs (a direct write path ↔ its retry/replay path)
- **one visual role in two elements** — equality grep finds only the pair that has not diverged yet,
  so key on the role. Signals, cheapest first: (a) complementary render conditions — branches that
  exclude each other and together cover one state (`activeId === row.id` per row vs.
  `activeId === null` after the list), also when CSS holds them (`md:hidden` ↔ `hidden md:flex`,
  `data-[state=…]`, `group-*`); that is one element in two places, and every difference counts,
  handlers and aria included; (b) a comment asserting the relation (probe 5); (c) overlapping class
  lists in one container or list, or between a placeholder and what it stands in for (skeleton ↔
  row, marker ↔ item), even across files; (d) a shared class constant at one site, a hardcoded subset
  at another. Compare token by token; tokens that follow the branch condition itself (`bg-primary`
  only when active) are intended.
- instruction files that play the same role in two places (the two reviewer agents, a command and
  the agent it delegates to). Grep is no help on these at all: the copies are paraphrases, often in
  different languages, so only reading them side by side finds them.
- a call site and the `components/ui/` wrapper it configures — passed-through `className`, slots,
  variants, default props; the contract is only legible with both files open. `checks.md` § "Style &
  Conventions" says how to resolve it.

If the diff touched one sibling, diff it against the others even when they are unchanged. And a diff
that *adds* a second renderer, store or entry point for something that already has one **creates**
the pair — fire on the addition, before there is a recognised set to be the other half of. That one
reads as a clean new file: the sibling it silently forked from is nowhere in the diff, and what it
failed to copy is invisible until a user hits it.

**3. The prior-art probe.** Two triggers. The first is every new exported function, type or schema:
grep the repo for what it does before accepting it — by verb *and* by the thing it operates on
(`persist`/`save`/`write` + the storage key; `parse`/`validate` + the schema). A new local helper that
re-implements an existing shared one is duplication that no diff view will ever show you. Grep the
*answer* as well as the verb: a new `…Count` duplicates any neighbour that already counts the same set
internally, however differently that neighbour is named. For a type or schema, grep the **fields**: a
local interface restating what `lib/types.ts` already declares, or a second zod schema over the same
shape, is the same duplicate one level up.

The second trigger is the one that misses: **every block the diff writes without a name** — an effect
or `useCallback` body, a store IIFE, a `useMemo`, three statements in a handler. Anonymous code
proposes no symbol to grep for, so a name-keyed probe walks straight past a block re-implementing a
well-named export one import away.

Key that grep on **behaviour**, and only where the behaviour touches something *shared*: a URL, a
storage key, a module-level store, a file on disk. Grep the shared thing — the endpoint, the key, the
setter — and read whoever already owns it. Local `useState` and props do **not** trigger this; a probe
that fires on every hook diff costs context and returns nothing. Two corollaries: the prior art
**need not be exported** — a module-private helper counts — and you must **look one level out**, because
the original usually sits in a sibling that already shares the state (the other hook behind the same
provider), not in the file the diff edits.

**4. The rule probe.** The same *decision* written twice is worse than the same code written twice:
the copies diverge silently and nobody notices until behaviour splits. Take every threshold, status
code, retry policy, magic constant and validation rule the diff introduces or touches, and grep the
repo for it. Two places deciding "is this retryable" must be one place — and so must two functions
resolving the same decision, or a helper that does not filter its own subset and forces the caller into
another bucketing pass.

Grep alone will not find the second copy, because it is rarely textually similar. So **enumerate the
layers that enforce, normalise or repair the rule** — UI, hook, offline write layer, schema/validation,
API route, filesystem read path, service worker, **and the stylesheet**. That last one is the entry this
list kept forgetting: a global CSS rule or a utility class enforces as hard as any branch, and nothing
in TypeScript points at it — `display: none` on a native input is half a rule whose other half is a
React `components` override, and `1024` in `matchMedia` is the same boundary as every `lg:` in the tree.
The default is **one**; a change that adds or extends a second is a finding unless it says what each
layer catches that the others cannot (server-side validation at the trust boundary is not a second
layer — the route cannot trust that the request came from your UI). Usual shape: the UI hides the
action *and* the write layer rejects the value — and because the UI already prevented it, that
rejection is a silent discard nobody will ever see.

**5. The comment probe.** Comments of the form "same as X", "the same judgement Y makes", "mirrors Z",
"see the note in W", "matches the …", "wie …", "analog zu" are a confession that two places encode one rule. Treat every such comment in the
diff as a finding until you have read both sides and can say why they must stay apart. A comment that
claims a count is the same confession — "the only caller", "called from four places": re-run the grep
before you trust it.

**6. The literal probe.** Grep the diff's own added string/number literals and repeated expressions
against the rest of the repo. Grep the **stable fragment**, not the whole literal: the other copy
usually interpolates the very constant you are hunting (`{DO_LIMIT}-Slot-Regel` against a test's
`/3-Slot-Regel/`) or differs by one word (`…diese Seite…` against `…diese Notiz…`). An exact-match
grep then returns nothing, and nothing reads exactly like a clean result.

**Every probe: read the delta, not the overlap.** Where two sides share a role, their difference *is*
the defect, not a risk: a dropped guard (timeout, `try`/`catch`, 401 branch), an added condition its
borrowed predicate cannot survive (`e.key === 'o'` under `shiftKey`), a missing or extra class token.
Report it with its effect — the behaviour that splits, or the width, radius, spacing, colour rendered.

Do not report a duplication you have not verified by reading both sides in full. Do not claim a probe
found nothing if you did not run it.

One scope limit governs all six: **none of them audits duplication that predates the diff.** A split
that was already there and stays untouched is not this change's finding. Every pass over this repo
turns up more of them — three copies of one lock helper, a private `parseTags` in two modules, an
exported helper with no caller while two components inline its body — and every one is real. But a
trigger that hunts them makes each review unbounded and returns the same list next time. They belong
in a standalone cleanup pass, not in a probe.
