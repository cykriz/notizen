# Review Checks

Single source, with `duplication-probes.md` beside it, for the duplication probes, the simplicity checks
and the severity floors. `.claude/plan-review-criteria.md` applies §§ "2a" / "2b" / "Correctness &
Bugs" / "Next.js Specifics" / "Style & Conventions" / "Severity Floors" to plans **by reference**, so
changing a rule here changes the plan review too — intentionally. Those six section titles are
load-bearing: rename one and the reference breaks silently, so update it in the same edit.

Duplication and unnecessary complexity are **first-class defects** here, not garnish on a correctness
review. § "Step 1" (`duplication-probes.md`) is mandatory and runs before anything else.

## 2a — Structural: is there less of it than there could be?

For each of these, the answer is a **count or a concrete input**. "Looks fine" is not an answer.

- **Deletion inventory (mandatory, first):** list every artifact the change adds — field, module, file,
  export, constant, migration/repair/backfill step, special case, test block — and name per item what
  concretely breaks if it goes *without replacement*. No named breakage → finding. This is removal, not
  inlining (which keeps the logic); the bullets below ask the narrower questions.
- **New parameter or option:** count its distinct values across every call site. One value → inline it
  and delete the parameter. Two values that are really a boolean mode → ask whether the caller should
  just call a different function.
- **New abstraction, wrapper, or indirection:** count the callers. One caller → inline it, unless it
  exists purely to stay under the file-line cap (a legitimate reason in this repo — say so explicitly
  when that is the case).
- **New state, ref, or prop:** can it be derived from what is already there? Derived beats stored.
- **New `?.`, `??`, `try`/`catch`, or default value:** name the real input that reaches the fallback
  (none → the inventory's case). If one exists, is the fallback *silent*? Swallowing a bad value so the
  user sees nothing is a defect — say what the user should see instead.
- **New generic/config-driven code:** generic for a second caller that exists *today*? If not, premature.
- **Widened types or new optional/persisted fields:** what breaks if they stay narrow/required? Before a
  new field gets a default, migration, backfill or repair path, show that no existing field already
  carries a usable initial value (`rank = order ?? createdAt`). Without that proof the whole apparatus
  is the finding, not its details.
- **Special-case lists:** count the branches keyed on the same discriminator. Three or more is a
  warning sign, not diligence — can one general rule replace them?
- **The change as a whole:** name what it *removes*. Nothing deleted, replaced or simplified is the
  shape of an addition nobody needed.

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
- **Affordances that lie:** an insertion mark, ring or cursor promising a position or target the
  handler does not write

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

Run it the other way too, for the inventory rows covering the paths the diff touches: a row naming a
module, path or route that no longer exists is the same finding. This is the direction nothing else
checks — a stale row is never in the diff of the change that invalidated it, so it can only be caught
by looking from the doc back at the tree.

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
- **Language residue.** The boundary itself arrives via `CLAUDE.md` § Key Rules — do not restate it.
  Only the residue is yours: `scripts/check-language.ts` runs on a wordlist, so bare German compound
  labels with no verb and no function word (`// --- Papierkorb ---`, `describe('ToDo-Board')`) pass it
  untouched. Report those; never report a quoted UI string, which the rule permits.
- **Override probe — run it, don't skim it.** Wherever the diff hands a `className` to a
  `components/ui/` component — **also when that class list is unchanged**, since the other half sits
  in a file the diff never touches — open the wrapper's base classes and resolve the effective
  string: `bun -e "import { cn } from './lib/utils.ts'; console.log(cn('<base>', '<caller>'))"`.
  `tailwind-merge` dedupes only *within* one class group, so an override from a neighbouring group
  loses silently and both survive: `flex-row`/`flex-col` against a base `grid`,
  `grid-cols-*`/`grid-rows-*` against a base `flex`, `hidden`/`block` against `flex`,
  `absolute`/`relative` against a position already set. `items-*`/`justify-*` are the clean-looking
  trap — they merge, and still mean something else under grid than under flex. A class list you did
  not print is not one you checked. Only this interplay is new; tokens, `cn()` object syntax and
  `dark:` arrive via `CLAUDE.md` § Style Rules.
- **Inert leftovers are a finding too**, even when nothing breaks: a class the resolved string keeps
  that does nothing in the chosen mode (`grid-rows-[auto_auto]` on a flex container, `flex-row` on a
  grid) either betrays a wrong intent or hands the next reader one. It closes when the caller drops
  it, when a neutralising class replaces it, or — for a leftover from the wrapper's own base that no
  call site can remove — when a comment at the call site records it. Silence does not close it.
- **Geometry, not visibility.** Where a change touches layout classes (`display`, `grid-*`,
  `flex-*`, `items-*`, `justify-*`, positioning, column/row templates),
  `toBeVisible()`/`toHaveCount()` secure nothing — both are just as true of a wrongly laid-out
  element. Require an assertion on real geometry (`boundingBox()`, `getComputedStyle`, two siblings'
  relative position), or a stated reason why geometry is irrelevant here.

## Severity Floors

These are minimums, not ceilings. Raise them when the impact warrants it.

- A decision rule (threshold, retry policy, status handling) implemented in two places — including two
  *layers* enforcing it in different words (UI *and* write layer, schema *and* route) → **High**
- A block of ~8+ lines that is identical modulo names/types in two places → **Medium**
- A new helper **or nameless block** that re-implements an existing shared one → **Medium**; **High**
  when the copy drops a guard the original carries or adds a condition its predicate cannot survive
- An extraction that converts one copy and leaves another standing → the floor of the duplicate it
  failed to remove
- A count asserted about existing code ("four call sites", "the only caller") with no re-run grep behind
  it → **Medium**; a count that turns out wrong → **High**
- Correctness that depends on statement order nothing enforces → **Medium**
- Nesting past depth 3, or a function whose decision points exceed ~10 → **Minor**, raised to
  **Medium** if the function is on a hot or hard-to-test path
- An artifact the change *adds* that is removable with no named breakage (§ 2a inventory) → **High**
- A parameter, option, abstraction or state field with exactly one real value or caller (inlinable,
  not removable) → **Minor**
- An override that fails to displace its base class, or two elements of one visual role whose visual
  attributes diverge (class list, `variant`/`size` props), and thereby changes the rendering → **High**.
  You cannot render: a differing token that sets width, margin/padding, radius, border or colour counts
  as visible. Behavioural differences between the branches take the dropped-guard floor above.
- The same divergence without visible consequence → **Medium**
- An override that fails to displace but stays without consequence, an inert leftover class, or one
  visual role's identical class list in two places → **Minor**
- A layout change secured only by `toBeVisible`/`toHaveCount` → **Medium**
- An existing export left without callers by this diff → **Minor**

## Fix Order

De-duplicate **before** fixing behaviour inside a duplicated block — otherwise the same fix gets
applied twice and the copies still diverge. Call out any fix that becomes unnecessary once an earlier
one lands.

---

## Deliberately not in this file

Do not "restore" these — each already reaches the reviewer another way, and a second copy is the
duplication this file rates highest:

- **Repeated literals → `lib/constants.ts`/`lib/types.ts`** and **the file-line cap as a reason for a
  one-caller wrapper** — injected via `CLAUDE.md` § Code Rules / § Key Rules.
- **Skill rules** — in the `SKILL.md` loaded on a match; only the instruction to apply them stays here
  (§ "Skill Compliance").
- **Which module owns which layer** (probe 4, `duplication-probes.md`) — in the `architecture` skill's
  references; listed here it would go stale on the first refactor.
- **Report layout** — the output contract lives in `.claude/agents/review-changes.md`; its one piece of
  check substance survives as § "Fix Order".
