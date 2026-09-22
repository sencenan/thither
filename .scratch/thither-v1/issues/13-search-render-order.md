# Implement .$: search, rendering, and match ordering

Type: task
Status: open
Blocked by: 11, 12

## Question

Implement `.$` — search with boundary inference (§4.4), argument rendering (§5), and match ordering (§5) — producing the `R` value that ends evaluation. Search never changes state.

**Generalize the matcher born in ticket 12 under its second caller.** `.$` is what forces the matcher's full shape: it needs a repeated "does this nonempty prefix yield ≥1 match combined with focus?" probe (longest-prefix inference), plus the per-target **`score`** (summed across query dimensions, for ranking) and **`positions`** (unioned string indices, ascending, deduped — a fuzzy token may span dimension boundaries, so these are string indices, not dimension indices, for `hint.positions`). Extend ticket 12's slot-selection helper to also return `score`/`positions`; the return shape settles here, now that both callers exist. This ticket owns §3's **scoring and boundary-spanning positions** fixtures. Scores are the port's — assert selection, positions, and relative order, never exact score numbers.

**Boundary inference (§4.4).** With a separator: the matching portion (before the standalone `.`) is matched in full against focus and never shortened; the suffix is arguments, not fuzzy-matched (so `S lookup . https://example.com .$` passes a URL argument unescaped). Without a separator: select the **longest** nonempty prefix of `L` that yields ≥1 match combined with focus — do not stop at the first unique match; the remaining literals are arguments. If matching literals were supplied but no nonempty prefix matches, return **no matches** (never fall back to focus, never shorten focus). No literals → focus alone; empty focus too → select all. `R.inputs` records the matching literals in original spelling, excluding focus, the separator, and arguments; a failed inferred search still reports the attempted inputs; a focus-only search has empty `inputs`.

**Rendering (§5).** Fill the original template's `{}` left-to-right with literal, case-preserved arguments (no percent-encoding; replacement text is never re-parsed as template syntax). `hint.argDelta = A − P` counts **every** supplied argument; `m`'s `[args]` holds only the applied ones (`first min(A, P)`); extras are ignored, missing placeholders left intact (partial destination in the first slot).

**Ordering (§5).** Emit `R.matches` in one total order so the client renders top-to-bottom without sorting: (1) nonnegative `argDelta` first, (2) `|argDelta|` ascending, (3) `hint.score` descending, (4) target-set order. So a weakly-scored `+1` precedes a strongly-scored `+2`. Ordering never manufactures uniqueness.

**Done when** fixtures cover the `company` / `company git` / `company git thither` prefix ladder (including the longer-prefix-still-matches case), no-prefix-match, focus-only, select-all, and `R.inputs` spelling; every row of the §5 rendering table (including `a/b` producing a path segment and the zero-placeholder template ignoring its argument); each ordering key isolated including the weak-`+1`-beats-strong-`+2` case; and the order proven total.
