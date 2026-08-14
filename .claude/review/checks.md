# Review Checks

Single source for the duplication probes, the simplicity checks and the severity floors.
`.claude/plan-review-criteria.md` applies §§ "Step 1" / "2a" / "2b" / "Next.js Specifics" /
"Style & Conventions" / "Severity Floors" to plans **by reference**, so changing a rule here changes
the plan review too — intentionally. Those six section titles are load-bearing: rename one and the
reference breaks silently, so update it in the same edit.

Duplication and unnecessary complexity are **first-class defects** here, not garnish on a correctness
review. § "Step 1" is mandatory and runs before anything else.

## Step 1 — Duplication Sweep (mandatory)

Noticing duplication while reading the diff does not count. Run these six probes explicitly. Each has
a known failure mode that reading top-to-bottom does not catch, because the two copies are never
adjacent.

**1. The extraction probe.** For every added file, and every file whose diff removes a block: find
where that code came from and confirm the original is gone. A refactor that adds the new home but
leaves the old copy in place is the most common duplication in a diff, and it always looks clean in
the diff itself — you only see the addition. Tells: a comment saying "split out of", "extracted from",
"moved to", or a new module whose exports mirror something already in the file it was carved out of.
Open both and compare the bodies line by line.

**2. The sibling probe.** Code that comes in sets rarely gets changed evenly. Read the siblings side
by side, never one after the other:

- entity pairs (`notes` ↔ `todos`, `lib/offlineNotes.ts` ↔ `lib/offlineTodos.ts`)
- verb sets (`create` / `update` / `delete`, `get` / `set`, `read` / `write`)
- transport pairs (a direct write path ↔ its retry/replay path)
- the branches of a component that render "the same thing in a different state"

If the diff touched one sibling, diff it against the others even when they are unchanged.

**3. The prior-art probe.** For every new exported function, grep the repo for what it does before
accepting it — by verb *and* by the thing it operates on (`persist`/`save`/`write` + the storage key;
`parse`/`validate` + the schema). A new local helper that re-implements an existing shared one is
duplication that no diff view will ever show you.

**4. The rule probe.** The same *decision* written twice is worse than the same code written twice:
the copies diverge silently and nobody notices until behaviour splits. Take every threshold, status
code, retry policy, magic constant and validation rule the diff introduces or touches, and grep the
repo for it. Two places deciding "is this retryable" must be one place.

**5. The comment probe.** Comments of the form "same as X", "the same judgement Y makes", "mirrors Z",
"see the note in W" are a confession that two places encode one rule. Treat every such comment in the
diff as a finding until you have read both sides and can say why they must stay apart.

**6. The literal probe.** Grep the diff's own added string/number literals and repeated expressions
against the rest of the repo.

Do not report a duplication you have not verified by reading both sides in full. Do not claim a probe
found nothing if you did not run it.

## 2a — Structural: is there less of it than there could be?

For each of these, the answer is a **count or a concrete input**. "Looks fine" is not an answer.

- **New parameter or option:** count its distinct values across every call site. One value → inline it
  and delete the parameter. Two values that are really a boolean mode → ask whether the caller should
  just call a different function.
- **New abstraction, wrapper, or indirection:** count the callers. One caller → inline it, unless it
  exists purely to stay under the file-line cap (a legitimate reason in this repo — say so explicitly
  when that is the case).
- **New state, ref, or prop:** can it be derived from what is already there? Derived beats stored.
- **New `?.`, `??`, `try`/`catch`, or default value:** name the real input that reaches the fallback.
  If none exists, it is noise — delete it. If one exists, ask whether the fallback is *silent*:
  swallowing a bad value so the user sees nothing is a defect, not defensiveness. Say what the user
  should see instead.
- **New generic/config-driven code:** is it generic for a second caller that exists today, or for one
  that might? Premature generalization is a finding.
- **Widened types or new optional fields:** what breaks if they stay narrow/required?

## 2b — Cognitive: how much must a reader hold in their head?

Short code can still be expensive to read. Judge each changed function by what it costs to understand
well enough to safely change, and **report the count you measured**.

- **Nesting depth:** count the maximum depth of nested `if`/`for`/`try`/callbacks in each changed
  function. More than 3 → finding. Guard clauses and early returns flatten it; say which branch to
  invert.
- **Decision points:** count `if`, `else if`, `?:`, `&&`/`||` used as control flow, `case`, and
  `catch`. Weight nested ones higher than sequential ones — three conditions in a row is a list, three
  nested is a maze. More than ~10 in one function, or any nesting past level 2, is a finding.
- **Boolean and mode parameters:** a parameter that forks the body is one function pretending to be
  two. Count how much of the body actually differs; if the two paths share little, split them and let
  the callers pick.
- **Live variables:** count the mutable variables and refs alive at the same time in a function, plus
  anything mutated from outside it (a ref written by a caller, a module-level flag). More than ~4
  things a reader must track at once → finding.
- **Implicit ordering:** flag any code whose correctness depends on statement order that the types do
  not enforce — "this must run before that", "this must stay synchronous", "read this before the
  await". Each one is a trap for the next editor. Say whether the order can be made structural instead
  of remembered.
- **Reading span:** how many other files must be open to understand this function? A function that
  only makes sense with three modules open is a finding regardless of its length.
- **Comment load:** a block that needs a paragraph of prose before it is safe to change is telling you
  the complexity is real. The comment is the symptom, not the fix. Ask what shape would let the
  comment shrink — usually a name, a narrower type, or a split. Do not treat a well-commented tangle
  as reviewed.
- **Naming:** a name you had to read the body to understand is a finding. Propose the better name.

Cognitive complexity is a finding on its own, even when the code is correct, unduplicated and short.

## Correctness & Bugs

- Logic errors, off-by-ones, unhandled null/undefined
- Missing error boundaries or try/catch in server actions
- Race conditions in async code or parallel fetches
- Errors swallowed into a state nothing can observe (an unreachable error branch is dead code *and* a
  missing affordance)

## Next.js Specifics

- Correct use of `"use client"` / `"use server"` — is the component client-side when it doesn't need
  to be, pushing logic to the browser?
- Data fetching: prefer `fetch()` with caching options over `useEffect` in server components
- `useRouter`, `useSearchParams`, `usePathname` must be in client components — flag misuse
- Server Actions: validate inputs, handle errors, avoid leaking sensitive data
- Dynamic routes: check `params` typing and `generateStaticParams` if applicable
- Metadata: `export const metadata` or `generateMetadata` present on page-level files?

## Skill Compliance

For each changed file, verify it follows the rules in the `SKILL.md` you loaded for it, and tag every
such finding with the skill name (e.g. `[styling]`, `[architecture]`). New modules that belong in a
skill's inventory but are missing from it are a finding.

## Performance

- Missing `Suspense` boundaries around async server components
- Images: `next/image` with `width`, `height`, and `alt`? No raw `<img>` tags
- Fonts: loaded via `next/font`, not external `@import`
- Missing `loading.tsx` or `error.tsx` for route segments that need them
- Invalidating a memo on every mutation when the underlying data rarely changes

## Style & Conventions

- PascalCase components, camelCase utils, kebab-case routes
- Page-specific components co-located inside the route folder
- No unused imports, dead code, commented-out blocks, or exports whose last caller the diff removed

## Severity Floors

These are minimums, not ceilings. Raise them when the impact warrants it.

- A decision rule (threshold, retry policy, status handling) implemented in two places → **High**
- A block of ~8+ lines that is identical modulo names/types in two places → **Medium**
- A new helper that re-implements an existing shared one → **Medium**
- Correctness that depends on statement order nothing enforces → **Medium**
- Nesting past depth 3, or a function whose decision points exceed ~10 → **Minor**, raised to
  **Medium** if the function is on a hot or hard-to-test path
- A parameter, option, abstraction or state field with exactly one real value or caller → **Minor**
- An export left without callers by this diff → **Minor**

## Fix Order

De-duplicate **before** fixing behaviour inside a duplicated block — otherwise the same fix gets
applied twice and the copies still diverge. Call out any fix that becomes unnecessary once an earlier
one lands.

---

## Deliberately not in this file

Three checks from the original `/review` command are omitted here because they already reach the
reviewer another way. Do not "restore" them — that would be the duplication this file rates highest.

- **Repeated literals → `lib/constants.ts`, type in `lib/types.ts`** (tail of probe 6) — **injected**
  via `CLAUDE.md` § Code Rules.
- **The file-line cap as a legitimate reason for a one-caller wrapper** (§ 2a) — **injected** via
  `CLAUDE.md` § Key Rules.
The skill *rules themselves* are the third case — they live in the `SKILL.md` the reviewer loads on a
match, so they are not restated here. The **instruction** to check a changed file against them does
stay, under § "Skill Compliance": without it the loaded skill would be read and never applied.

The original § "Output Format" and the layout of § "Copyable Fix Plan" are gone on purpose: they were
report formatting for a human reader, and the reviewer now writes to an agent under the output
contract in `.claude/agents/review-changes.md`. Their one piece of check substance — the fix ordering
rule — survives above as § "Fix Order".
