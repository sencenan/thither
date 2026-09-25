# Implement arity-keyed variants, exact-key `.set`, arity-targeted `.rm`

Type: task
Status: resolved
Blocked by: 27

## Question

Implement the amended `docs/dsl.md` from ticket 27 ([ADR 0008](../../../docs/adr/0008-arity-keyed-variants-and-exact-key-set.md)). Test-first per `docs/code-standards.md`; fixture names cite the new section text.

In scope:

- `src/dsl/types.ts`: `Target` → key + `Template[]`; `State.targets` → `{ [key: string]: Template[] }`; `Match` slot 2 → `key: string`; drop `ambiguous_set` from `ErrorTypes`.
- `src/dsl/parser.ts`: validate/normalize the new `S` shape — keys re-normalized from their dims (trim/lowercase/dedupe/sort/join), duplicate keys after normalization → `parse_error`, each variant validated as a destination, duplicate arity within a target → `parse_error`, variants sorted by arity ascending on the way in. Focus may carry search operators; targets' dims still may not. Update `R` shape check for `m.key`.
- `src/dsl/utils.ts`: a `keyOf(dims)` helper and `arityOf(template)` (move the `split('{}')` count out of `search.ts`).
- `src/dsl/selector.ts`: fzf `selector` returns the key; `Selection.target` becomes the key + variants pair.
- `src/dsl/operations/set.ts`: drop `searchTargets`; ignore focus; exact key lookup; insert / replace-by-arity / add-variant; remove the ambiguity branch.
- `src/dsl/operations/rm.ts`: keep the fzf query with focus; read the suffix — no separator → delete matched targets; separator → arity = suffix length, delete that variant from each matched target, drop emptied targets.
- `src/dsl/operations/at.ts`: remove the operator refusal.
- `src/dsl/operations/search.ts`: per selected target, best fit → one match, else one per variant; `toMatch` takes a key; new comparator (score desc, matcher order, then `0` / `+` asc / `−` by magnitude asc within a target — group rows by key so they stay contiguous).
- `src/dsl/index.ts` / `env.ts`: nothing expected beyond type exports.
- Tests: `operations/tests/{set,rm,at,search}.test.ts`, `tests/{golden,operators,parser,interpreter}.test.ts` rewritten for the new shapes; add the variants golden from §7.
- `src/client/view.ts` + tests: render `m[1]` as the key string (it was a dims array). `session.ts` `decideNavigation` is unchanged (`matches.length === 1 && argDelta >= 0`); confirm with a fixture where one target with two variants and no exact arity yields two matches and does not navigate.
- `src/client/browser-env.ts`: no migration; a stored record in the old shape parses to `parse_error` and is reset by hand (ADR 0008 consequences). Add a fixture pinning that.
- `scripts/repl.ts`: adjust any state printing/usage comment.

**Done when** `pnpm verify` is green, the §7 goldens (including the new variants golden) pass exactly through the barrel, and the REPL walk `https://jira.com jira .set` → `https://jira.com/browse/{} jira .set` → `jira` (one match) → `jira PROJ` (one match) → `jira PROJ x` (two matches) → `jira . x .rm` → `jira PROJ` (one match, `argDelta +1`) behaves as the ADR describes.

## Answer

Implemented ADR 0008 across the core, client, and REPL. `pnpm verify` is green (273 tests); the §7 goldens (including the new **Variants of one target** golden) pass exactly through the barrel; and the REPL walk behaves as the ADR describes (verified live — `jira PROJ x` shows two rows and does not navigate, `jira . x .rm` then leaves the arity-0 variant so `jira PROJ` navigates with `argDelta +1`).

**State shape.** `Target` is now `readonly [key, variants]`, an internal selector entry pair, no longer a client-facing value type, so it was **dropped from the barrel** (clients handle `State`/`TargetSet`); `State.targets` is a `TargetSet` (`{ [key: string]: Template[] }`), exported in `Target`'s place; `Match` slot 2 is the `key` string; `ambiguous_set` is gone from `ErrorTypes`. `keyOf(dims)` and `arityOf(template)` moved into `utils.ts` (the `split('{}')` count left `search.ts`). `emptyState()` is `{ targets: {}, focus: [] }`.

**Parser.** `parseState` validates the keyed-object shape: each key is re-normalized from its dimensions (a duplicate after normalization, an empty key, or a key carrying operator syntax is `parse_error`), each variant is validated as a destination, two variants sharing an arity is `parse_error`, and variants are sorted arity-ascending on the way in. **Focus is stored verbatim** (dsl.md §3 — no normalization; escapes resolve on use) and may carry operators; each focus term must still be a valid single literal (non-empty, whitespace-free, not operator-only). `isMatch` reads `m.key` as a string.

**Operations.** `.set` dropped `searchTargets`: it ignores focus, computes the exact key, and inserts / replaces-by-arity / adds-a-variant (operators still refused as `invalid_dimension`). `.rm` keeps the fzf query (focus + explicit); no separator removes whole targets, a separator's suffix *length* is the arity to remove per matched target, and an emptied target is dropped. `.@` stores the matching portion verbatim and no longer refuses operators. `.$` fans out per selected target — best fit → one match, else one per variant — with the new comparator: score desc across targets (ties → target-set order via stable sort over the object's iteration order), and within a target `0` / positive asc / negative-by-magnitude asc, rows grouped by key so they stay contiguous.

**Client / REPL.** `view.ts` renders `m[1]` as the key string. `session.ts` `decideNavigation` is unchanged; a fixture confirms a two-variant / no-exact-arity target yields two matches and does not navigate. `browser-env.ts` needs no migration — a stored record in the old array shape now parses to `parse_error` and is left untouched for a hand reset (pinned by a new fixture, ADR 0008). `scripts/repl.ts` seeds and prints the keyed shape (its sample set now includes a two-variant `jira`).

**Design note found while implementing:** `.$`'s longest-prefix inference fuzzy-matches argument letters against the key, so variant-fan-out tests that need a fixed argument count use an explicit `.` separator to pin the boundary. No spec change — the fixtures just avoid accidental prefix extension.

Branch `ticket/28-variants-implementation`; code, this Answer, and the map line land in one commit, left for human review per branch-hitl.
