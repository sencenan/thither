# Build the fuzzy matcher adapter

Type: task
Status: resolved
Blocked by: 04

## Question

Implement and test matching per `dsl.md` §3 and §5 "Matching evidence", on top of the npm `fzf` port.

Rules in scope:

- Join each target's canonically sorted dimensions with spaces into **one searchable string**.
- Build the query: take the operation's explicit matching literals, use lowercase copies for matching (originals retained elsewhere), prepend focus, deduplicate.
- Match each query dimension **independently** against the whole searchable string; select only when every dimension matches; sum the per-dimension scores. A fuzzy token may span dimension boundaries.
- Query-dimension order never affects selection or score: `git company` and `company git` behave identically.
- Case-insensitive; diacritic normalization **disabled** (`cafe` does not match `café`).
- No fzf query operators: do not route user input through `extendedMatch`; compose literal fuzzy patterns yourself. The [fzf research note](../../../docs/research/fzf-libraries.md) flags this as the integration trap.
- No confidence threshold or winner-margin rule — a first-ranked match is not automatically unique.
- `hint.positions`: ascending, deduplicated **union** of matched character indices across all query dimensions, as indices into the searchable string. A character matched by two dimensions appears once; the list does not record which dimension matched it.
- `hint.score`: the summed score; no breakdown required, though an extra debugging field is permitted.
- A query with no dimensions selects everything with empty `positions` and `score: 0`.

Configure `fzf` explicitly (`fuzzy`, `casing`, normalization, tie-breakers) rather than relying on its defaults, and pin the version. Test Thither's expected behaviour, not parity with upstream fzf.

**Done when** the configuration is explicit and justified on this ticket, and fixtures cover multi-dimension AND selection, boundary-spanning tokens, order independence, the diacritic case, and the empty-query case.

## Answer

Implemented `src/dsl/lib/matcher.ts` over the pinned `fzf@0.5.2` port (a DOM-free leaf; `node_modules` isn't cruised so the `dsl -> fzf` edge is fine). One export:

`match(targets, queryDimensions: readonly Dim[]) -> readonly TargetMatch[]`, where `TargetMatch = { target, positions, score }`. It matches **each query dimension independently** against each target's canonically-sorted, space-joined searchable string, keeps only targets matched by **every** dimension (AND), sums the per-dimension scores, and unions the matched positions (ascending, deduped). Returned in target-set order, which ticket 12 uses as the final ranking tiebreak. `argDelta` and ordering are deliberately **not** here (rendering, ticket 12).

**Seam (refined during review).** The matcher takes a single flat `queryDimensions` list and has **no `focus` parameter**. Matching treats every query dimension alike (order-independent, AND-selected), so "focus" is not a matching concept — passing it in leaked a state/operation concept into a primitive whose only use of it was `[...focus, ...explicit]`. Combining focus with the explicit matching literals, and the focus-vs-explicit distinction (`.set`/`.rm` needing ≥ 1 explicit dimension; `.$` recording `R.inputs` as explicit-only), now live above this seam in the operations (tickets 10/11). This refines ticket 04's seam row: the matcher owns *matching*, not query construction.

**Normalizes its own input.** `match` normalizes each query dimension (dsl.md §3 lowercase-copies-for-matching, via the `dimension` seam) and dedupes, so it does not care whether a caller passes raw stack literals (`Dim`) or already-normalized dimensions — normalization is idempotent, which is why a caller can fold in `NormDim` focus freely. This isolates the raw-vs-normalized question to one place instead of an asymmetric parameter list.

**Composition, not fzf's list ranking.** fzf ranks a whole list against one pattern; Thither's rule is the transpose (each dimension against one string, AND across dimensions). So the adapter runs one `Fzf` per query dimension over the target objects and aggregates onto each candidate. Candidates are matched via a **selector over objects**, never raw strings, so two targets that happen to share a searchable string are still counted separately. An **empty query** short-circuits to every target with `score 0` and empty `positions` (§3/§5: a sum over zero dimensions is 0).

**Explicit fzf configuration (justified, per the ticket):**

- `fuzzy: "v2"` - the fuzzy algorithm dsl.md assumes; chosen explicitly rather than inheriting a default.
- `casing: "case-insensitive"` - dsl.md §3 matching is case-insensitive; **not** the port's default `"smart-case"`, which would flip behaviour on an uppercase query.
- `normalize: false` - disables the port's diacritic folding so `cafe` does not match `café` (dsl.md §3 "diacritic normalization disabled"); the port defaults this to `true`.
- `match: basicMatch` - sends each dimension as **one literal fuzzy pattern** and never imports fzf's extended-query operators (`!`, `^`, `$`, `|`), the integration trap the fzf-research note flags. Each query dimension is space-free, so basicMatch treats it as a single token.
- `sort: false` - ranking is dsl.md §5's job (ticket 12); the port must not impose its own order or tie-breakers. Aggregation is order-independent anyway.

fzf `positions` are indices into the selector string, i.e. the searchable string, exactly what §5 requires. **Scores are the port's**, not upstream-fzf-parity; tests assert Thither's behaviour (selection, position indices, relative score), never exact score numbers (fzf-research note).

Tests: `src/dsl/lib/tests/matcher.test.ts` - multi-dimension AND (and its negative), order independence (same selection + score reversed), internal normalization (case-insensitive match, dedup of dimensions that normalize equal, diacritic case both ways), positions as string indices (`git` -> `[8,9,10]` in `company git`), boundary-spanning (`yg` -> `[6,8]`), ascending-deduped union, score summation (two dims > one), cardinality retained (both `git` targets returned, no winner-margin), empty-query-selects-all with empty evidence, and target-set order preserved. Full `pnpm run verify` green (137 tests). Unblocks 10 (with 06, 09) and 11 (with 09).
