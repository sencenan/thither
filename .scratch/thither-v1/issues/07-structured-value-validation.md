# Validate and normalize supplied structured values

Type: task
Status: resolved
Blocked by: 04, 06

## Question

Implement and test the structured-value half of `parse` per `dsl.md` §2 "Supplied structured values" and §3's normalization rules.

Rules in scope:

- Accept `S`, `R`, and `E` envelopes as top-level values; standalone `t`, `T`, `m`, `M` parse to `E`.
- Reject malformed required structures. Per `dsl.md` §6's phase rule, **every** parse-time rejection carries `type: "parse_error"`, whatever its cause (malformed envelope, standalone `t`/`T`/`m`/`M`, duplicate normalized dimension sets, a bad destination inside a supplied `S`). Preserve unknown object fields *only on `E`* as uninterpreted data that never acquires execution semantics; unknown fields on `S` and `R` are dropped (`dsl.md` §2).
- Normalize a supplied `S`'s target dimensions and focus: `trim()`, locale-independent `toLowerCase()`, deduplicate, sort by default string order (UTF-16 code units). Reject dimensions with internal whitespace after trimming — that is invalid, not a request to split one dimension into several.
- Normalization must not change target order, destination text, argument spelling, or `R.inputs`.
- Within one target set, every normalized dimension set must be unique; duplicates make the value invalid, whether or not the destinations differ (`["Git", " company ", "git"]` normalizing onto an existing `["git", "company"]`). Do not merge or pick. Different `S` values in one program may each contain the same dimension sets.
- Validate every destination inside a supplied `S` via ticket 06.
- Validation happens at parse time, not when the item is reached: an invalid value placed after a terminal result still parses to `E`.

This is also the entry point the client reuses to validate manually supplied reset JSON, so its failure mode must be a returned `E`, never a throw, and a value that parses to `E` must not be allowed to replace persisted data.

**Done when** fixtures cover each rejection reason, the normalization examples from §2 and §3, unknown-field preservation, and order preservation.

## Answer

Implemented the structured-value half of parse across two modules (both DOM-free leaves; boundaries clean):

**`src/dsl/lib/normalization.ts`** (its own file per ticket 04's seam map, so ops 10/11 can mint `NormDim`s without structured-value validation):

- `normalizeDimension(raw) -> NormDim | undefined` - trim, then reject internal whitespace (`\s`), then locale-independent `toLowerCase()`. `undefined` signals invalid. Diacritics are preserved (`Café` -> `café`), matching §3's "diacritic normalization disabled".
- `normalizeDimensions(raw[]) -> readonly NormDim[] | undefined` - normalize each, then dedupe and sort by default UTF-16 order (`[...new Set(x)].sort()`); dedup/sort happen *after* normalization so `Git`/`git` collapse. Returns `undefined` if any member is invalid.

**`src/dsl/lib/structured-value.ts`** - `validateStructured(value: unknown) -> ProgramItem` (the item `append` puts into a program), dispatching on the `["S"|"R"|"E", body]` sigil. The per-sigil validators return a concrete `State`/`Result`/`ThitherError` or `undefined` (the same verdict shape as ticket 06's `validateDestination`, and avoiding the vague `Envelope` type); `validateStructured` turns `undefined` into a generated `parse_error` (§6 phase rule, confirmed with you). A *valid* supplied `E` is returned as itself.

- **Top-level shape:** must be a 2-element array with a string sigil. This is what makes standalone `t`/`T`/`m`/`M` and a bare literal array all fall to `parse_error` (their head isn't a sigil string, or the arity is wrong) - dsl.md §1's "cannot appear as standalone values".
- **`S`:** normalizes focus and each target's dimensions via the normalization seam, validates each destination via **ticket 06** (`validateDestination`), enforces uniqueness of normalized dimension sets using the sorted-list JSON as a canonical key (duplicates invalid whether or not destinations differ; no merge/pick), preserves target order, and drops unknown fields by rebuilding from `targets`/`focus` only.
- **`E`:** the weaker §6 rule - only string `type` + `description` required, `type` **not** checked against the vocabulary (another version's error round-trips), extra diagnostic fields preserved via a detaching shallow copy.
- **`R` (per the shallow decision we agreed):** shape-checked only - `matches` an array of 4-tuples `[string, string[], string[], object]`, `inputs` a string array. **No normalization** (inputs/dims kept verbatim) and **no destination re-validation**, because a produced `R` legitimately holds partially-rendered, post-substitution destinations (§5) and `R.inputs` must stay in original spelling (§2). Unknown fields on `R` dropped.

**Design decisions surfaced and confirmed this session:**

1. **`ErrorType` corrected to §6** in a separate prior commit (`fix: align ErrorType with dsl.md §6 error vocabulary`): `parse_error | invalid_destination | missing_operand | ambiguous_set`, dropping the stale `invalid_value`/`missing_dimensions`/`invalid_stack` ticket-04 draft had.
2. **Ticket body corrected** (Finding 3): its old `invalid_value` wording replaced with the §6 phase rule (all parse-time failures are `parse_error`).
3. **`R`/`E` validation depth** decided as above.

Tests: `normalization.test.ts` (§3 trim/lowercase/diacritics/dedupe/sort/order-independence/internal-whitespace) and `structured-value.test.ts` (S normalization + order + unknown-field drop, the §2 duplicate-dim-set example, every rejection reason as `parse_error`, standalone `t`/`T`/`m`/`M`/`L` rejection, E extra-field preservation + weaker rule, R shallow pass-through + verbatim inputs + partial-destination acceptance). Inputs deep-frozen to catch accidental mutation. Full `pnpm run verify` green (119 tests). Unblocks **09** (with 05, already resolved).
