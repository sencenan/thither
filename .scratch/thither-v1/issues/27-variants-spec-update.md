# Amend `dsl.md` for arity-keyed variants and exact-key `.set`

Type: task
Status: resolved

## Question

Rewrite `docs/dsl.md` to match [ADR 0008](../../../docs/adr/0008-arity-keyed-variants-and-exact-key-set.md) and the updated [CONTEXT.md](../../../CONTEXT.md) terms (**Key**, **Variant**, **Arity**, **Best fit**). Spec only: no code in this ticket. Use the glossary's terms and avoid its `_Avoid_` words ("searchable string" is now an avoid word).

Sections and what changes:

- **§1 Value types.** `t` becomes a key → `Template[]` entry; `T` a map from key to variants (no two variants of one target share an arity; sorted by arity ascending). `m` becomes `[u_or_p, key, [args], hint]`. Say what a supplied `S` violating the variant invariants parses to (`parse_error`).
- **§1 Transitions.** `.set` row: "no target with that key inserts; an existing target replaces or adds the variant of that arity". `.rm` row: mention the separator's arity meaning. Drop the "more than 1 errors" clause.
- **§2 Separator.** "Only `.$` uses the suffix" → `.$` uses its tokens, `.rm` uses its count, `.set`/`.@` ignore it.
- **§2 Search operators.** Focus may carry operators; only stored dimensions (targets) may not. `.@` no longer refuses them.
- **§3.** Rename searchable string → key throughout. Focus is prepended for `.$` and `.rm` only. `.set` does not search: it compares keys exactly. Remove the `.set` bullet's "matches the entire explicit matching portion" and the focus-operator prohibition.
- **§4.1 `.set`.** New algorithm: destination first (unchanged), explicit dims required (unchanged), operators refused (unchanged), **focus ignored**, key = normalized explicit dims joined. Table: no target → insert with one variant; target exists, same arity → replace that variant; target exists, new arity → add variant (list stays arity-sorted). Delete the ambiguity row and the "fuzzy updating does not rename" paragraph; replace with the `[company, jira]` vs `jira` example showing that `jira` now creates its own target.
- **§4.2 `.rm`.** Matching portion + focus is still an fzf query. Without separator: remove matched targets whole. With separator: suffix length = arity; remove that variant from every matched target; no such variant is a no-op; a target left with no variants is removed. `jira . .rm` is arity 0.
- **§4.3 `.@`.** Remove the operator refusal and its `invalid_dimension` mention.
- **§4.4 `.$`.** After boundary inference, per selected target: best fit → one match; otherwise one match per variant. Show a worked `[jira]` {0,1} example for `jira` (one match, navigable) and `jira PROJ extra` (two matches, fallback).
- **§5 Rendering.** Per variant, unchanged formula. **Ordering** replaced: (1) score descending, (2) matcher order between equal scores, then within a target (3) `argDelta` 0 first, (4) positive ascending, (5) negative by `|argDelta|` ascending. State that a target's rows are contiguous. Direct-navigation sentence stays: exactly one match, nonnegative balance.
- **§6.** Remove `ambiguous_set` from the table and from `ErrorTypes`' prose; `invalid_dimension` is raised by `.set` only; add the variant invariants to `parse_error`'s "raised when"; update the unwinding example that relied on an ambiguous `.set`.
- **§7.** Rewrite the goldens to the new `S` shape and `m` shape; add a variants golden (create `jira` {0,1}, search `jira`, search `jira PROJ`).
- `docs/browser-client.md`: the step-4 navigation rule is unchanged in wording; check any `.set`/state examples for the new shape.

**Done when** every rule in ADR 0008 has a normative sentence in `dsl.md`, no `_Avoid_` term from CONTEXT.md appears in it, and `pnpm check` (prettier/biome on markdown, if configured) is clean. Ticket 28 implements against this text.

## Answer

`docs/dsl.md` now specifies [ADR 0008](../../../docs/adr/0008-arity-keyed-variants-and-exact-key-set.md) end to end, in the glossary's vocabulary (key, variant, arity, best fit; "searchable string" is gone):

- **§1** `k` added; `t` is one `k: [p]` entry, `T` is `{ k: [p] }`, `m` is `[u_or_p, k, [args], hint]`; a match is one variant of a selected target. Transition rows for `.set`/`.rm` reworded.
- **§2** Separator: `.$` takes the suffix, `.rm` reads its length, `.set`/`.@` ignore it. Operators legal in `.$`, `.rm`, and focus; refused by `.set`. Supplied `S`: keys split/normalized/rejoined, empty or operator-bearing keys and duplicate normalized keys are `parse_error`; variants validated, duplicate arity is `parse_error`, list sorted by arity on parse.
- **§3** Key defined as identity + match text. **Focus is no longer normalized at all** (a gap the ADR left open, settled with the human): stored verbatim like any literal array — typed order, original case, accumulated escape form, resolved when the query is built — because `|` binds by position and smart-case should behave as it does in a typed search; each term must still be a valid single literal. Target-set order = object iteration order, promised only as a tiebreak. `.set` described as exact-key, no search, no focus.
- **§4.1** Exact-key algorithm and three-row table (none → insert; same arity → replace; new arity → add). `company jira` vs `jira` example; two-`.set` jira example. **§4.2** Whole-target vs arity-by-suffix-length removal, emptied targets removed, four examples. **§4.3** Operator refusal removed. **§4.4** Best fit → one match, else one per variant; `jira` / `jira PROJ` / `jira PROJ extra` walkthrough.
- **§5** Rendering per variant; `positions`/`score` shared by a target's rows; ordering rewritten as score → target-set order across targets, then `0` / `+` asc / `−` by magnitude within a target, rows contiguous; direct navigation = exactly one match with Δ ≥ 0.
- **§6** `ambiguous_set` dropped; `invalid_dimension` is `.set`-only; `parse_error` lists the key/variant invariants; the unwinding example now fails on `invalid_destination`.
- **§7** All goldens moved to the `{ key: [variants] }` and `m.key` shapes; "Preserve ambiguity" reordered per the new rule; new **Variants of one target** golden (two `.set`, `jira`, `jira PROJ`, `jira PROJ extra`, `jira . x .rm`); the empty-query golden's order flipped to target-set order.
- `docs/browser-client.md`: reset example uses `"targets": {}`; step 4 navigation rule says "exactly one match".

`pnpm verify` green (no code touched). Unblocks [Implement arity-keyed variants](28-variants-implementation.md).
