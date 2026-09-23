# Implement .set, .rm, and .@

Type: task
Status: resolved
Blocked by: 11

## Question

Implement the three state-changing operations per `dsl.md` §4.1–4.3, registered as operations in the core's environment, failing through the error/unwind primitives from ticket 11.

**The matcher is born here.** There is no standalone matcher ticket (the old ticket 10 was deleted — a matcher built without a caller just guesses its interface, the ticket-08 mistake). `.set`/`.rm` are the matcher's first real callers, so grow the selection helper *inside this ticket* with the signature these callers dictate: given a target set and a combined (explicit + focus) query, return **which targets match, by slot**. `.set`/`.rm` need selection and slot identity only — **no `score`, no `positions`** (those are demanded solely by `.$`, so they arrive in ticket 13, which generalizes this helper under its second caller). This ticket owns §3's **selection** rules: every query dimension must match (AND), query-dimension order is irrelevant (`git company` ≡ `company git`), an empty query selects all targets, matches come back in target-set order. Reuse the fzf config settled in [08-matcher-adapter](08-matcher-adapter.md)'s answer (`fuzzy:'v2'`, `casing:'case-insensitive'`, `normalize:false`, `match:basicMatch`, `sort:false`); do not import fzf's query operators.

**`.set`**: extract the **last** literal of `L` as the destination (never search backward for a URL), validate it (`invalid_destination` on failure), keep the matching portion of the remainder, require **at least one explicit dimension** there — focus cannot satisfy it — then match the combined (explicit + focus) query in full. Zero matches appends a new target with the normalized combined dimensions to the **end** of the target set; exactly one replaces only that target's destination, preserving its dimensions and position; more than one raises `ambiguous_set` with the input state left unchanged. Fuzzy updating never renames dimensions. Missing destination, missing explicit dimension, or missing state anywhere is `missing_operand`.

**`.rm`**: with no `L`, or an empty matching portion, leave state unchanged without matching, regardless of focus — focus alone never authorizes removal. Otherwise match the complete combined query and remove every match; zero matches is a successful no-op, multiple are allowed; never shorten the query (`company nonexistent` does not retry `company`).

**`.@`**: normalize the matching portion and **replace** focus with it, never combining with the old focus; no `L`, or an empty matching portion, clears focus (`S company . git .@` sets focus to `[company]`, not `[company, git]`).

All three ignore the separator's suffix and must preserve input state until they succeed, upholding §3 target-set order: supplied order kept, inserts appended, updates in place, removals without reordering — that order is the final ranking tiebreak.

**Done when** fixtures cover each `.set` cardinality row and its `missing_operand` / `invalid_destination` / `ambiguous_set` cases, the focus-never-authorizes-removal cases (`S .rm`, `S . ignored .rm`), the `.rm` no-retry case, `S company . git .@`, and target-set order across all three operations.

## Answer

Implemented `.set`, `.rm`, and `.@` as `src/dsl/operations/{set,rm,at}.ts`, one file per operation, each exporting a single `OpFn` (`at` because `@` is not an identifier and `focus` would shadow the field it sets). 94 tests green across three table-driven suites (`operations/tests/{set,rm,at}.test.ts`, 23 + 16 + 13 rows) sharing `operations/tests/harness.ts`. Landed on `main` as merge `9335328` over three commits (`e45004e`, `e250d5b`, `4d3c13c`).

**Operation shape — peek-not-pop, made concrete.** Every operation pops the top, checks it, peeks the state beneath, and fails through the seal-aware `push`; the state is popped only on success, immediately before `S'` is pushed. §6's unwind shapes (`[S] → [S, E]`, `[L] → [E]`, `[S0, L0, S1, L1] → [S0, L0, S1, E]`) and the sealed-stack absorption (`[S, L, E] .set → [S, L, E]`) fall out with no re-push machinery; a first draft that popped both values and re-pushed them dropped `S` in two cases and was rewritten. A hand-built `[L0, L1]` (unreachable through the evaluator) pins the contract directly: `[L0, E]`. Each operation's legal `[K, S]` shape (`.rm` no-op, `.@` clear) is one early branch pushing the `S` straight back.

**The matcher was born here as `src/dsl/selector.ts` → `selectTargets(targets, query): Target[]`.** One `Fzf` over the target *objects* (`selector: dims.join(' ')`), **fzf defaults throughout**, fed the normalized query as **one space-joined pattern** in a single `find`. Returns matched targets by identity, so `.set` updates in place and `.rm` filters without reordering. This **supersedes ticket 08's recorded config** (`fuzzy:'v2'`, `casing:'case-insensitive'`, `normalize:false`, `match:basicMatch`, `sort:false`, per-dimension AND): the point of using fzf is to hand it the joined dimensions as the search term, and its defaults (smart-case, diacritic normalization on, sorted results) are the behaviour wanted. Consequence: `hub git` no longer selects `[github]` (the pattern needs its space), and `cafe` matches `café`. No score/positions yet — `.$` (ticket 13) adds those.

**Spec rulings, each amended in `dsl.md` and pinned by a fixture:**
- §3: the query is one sorted, space-joined fuzzy pattern matched in one pass (was: independent per-dimension AND, "do not pass the whole space-joined query"); matching is diacritic-insensitive (was: `cafe` does not match `café`).
- §4.1 step 1 / §6: the last literal of `L` is *always* the destination, so `S company git .set` is `invalid_destination`, not `missing_operand` (the spec had no rule separating "no destination literal" from "a broken destination"; a colon heuristic was tried and rejected as unstated). §6's `missing_operand` example block corrected — two of its four programs were wrong under either rule.
- §5: `positions`/`score` are the matcher's for the single pattern (forward-looking, for `.$`).

**Shared helpers moved to `utils.ts`:** `push` (the seal, out of `interpreter.ts`), `isTemplate` and `normalizeDimensions` (out of `parser.ts`), plus new `splitAtSeparator(literals): [matching, suffix]` (§2's division as a labelled tuple; `.$` will read the suffix) and `resolveEscape` (`..x` → `.x` at use; first exercised by `S [[.git]] ..git .rm`). Escapes resolve before normalization because focus and stored dimensions are *stored* dimension lists (§1).

**Standards changes (`code-standards.md`):** the "head each `src/dsl` module with its spec section" rule was dropped; `src/dsl/operations/` is documented as the core's third internal folder and fenced in dependency-cruiser alongside `lib/` and `tests/` (proven: a `src/client` import of `operations/set` trips both `area-internals-are-private` and `dsl-entry-point-only`). **The DOM-free core check, silently dropped in the `bff4055` rewrite, is restored**: `tsconfig.dsl.json` is back, `typecheck` runs both passes, and `utils.ts` re-supplies `URL` with a module-scoped `declare const` (now the reference example). A `localStorage` probe in the core fails the second pass with `TS2304`.

**Not done, deliberately:** `defaultEnv()`, `index.ts` wiring, `emptyProgram`/`initialStack`, and the §7 golden programs — all ticket 14. §4.2's "the interpreter still appends `.$`" is untestable with the identity `.$` stub and waits for ticket 13. Three operations now share an identical 12-line prelude; extract it once `.$` is the fourth caller, not before.
