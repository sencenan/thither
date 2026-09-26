# Should a best fit hide the target's other variants?

Type: grilling
Status: resolved

## Question

Found while hand-testing ticket 43. A target with variants of arity 1 and 2, given one argument, yields exactly one match — the arity-1 variant — and the arity-2 variant is nowhere in the `R`. This is core behaviour, not the client's: `dsl.md` §4.4's **best fit** says a target with a variant whose arity equals the argument count yields exactly one match, for that variant, and `matchesFor` in `src/dsl/operations/search.ts` does just that. The per-variant fan-out happens only when *no* variant fits. On the page the question rarely even arises: one match with `argDelta ≥ 0` and a non-empty `R.inputs` auto-navigates (ADR 0009), so the list is never shown for this case; it is visible in the REPL and in a live-typed query on the fallback page.

This is [ADR 0008](../../docs/adr/0008-arity-keyed-variants-and-exact-key-set.md)'s design — the argument count *selects* the variant, which is what lets `jira PROJ` go straight to `browse/PROJ` instead of stopping at a list that also offers `jira.example.com`.

Decide whether that is what we want, or whether the fallback page should still show the other variants for context when a best fit exists (e.g. dimmed, below the navigable row). If the latter:

- It is a §4.4 change: `R.matches` would carry rows that are not candidates for navigation, and today the flat list cannot say which row is the best fit versus context. Either the client infers it from `argDelta` (the only `0` row of a target) or the `R` gains structure.
- ADR 0009's rule (`R.matches` has exactly one entry) would need restating — "exactly one match with `argDelta = 0`", or a best-fit marker — so that context rows do not suppress auto-navigation.
- Live typing on the fallback page is where the extra rows would be seen; `match-list.ts` renders emitted order as-is and would need a visual distinction.

Grill: who benefits from seeing the arity-2 row when the arity-1 one already navigates? Is the cost (a two-kinds-of-row concept in the `R`, two ADR amendments) worth it, or is the REPL's terse view the only place this is even noticed?

**Done when** the human decides keep-as-is (record the reasoning here) or a build ticket is filed with the `R` shape and the ADR 0009 restatement settled.

## Answer

**Surface the siblings — but by *removing* the best-fit special case, not by adding a two-kinds-of-row concept.** The human's insight settled it: within one target at most one variant has `argDelta === 0` (one variant per arity), so the best-fit drop is *redundant* with a navigation rule keyed on `argDelta`. The core can always fan out one match per variant, and `argDelta` alone tells the client which row (if any) is navigable — no best-fit marker, no `R` restructure, and the discoverability the ticket asked for falls out for free (siblings appear on the page, the REPL, and in a live-typed query). This retires best-fit *as a selection mechanism*; the term survives only as "the exact-arity variant = the `Δ0` row".

Rejected the three options originally sketched:

- **Keep-as-is** — loses no functionality but leaves the terse hiding the human noticed while hand-testing 43.
- **Client-only context via `register.state.targets[key]`** — cheap, but a second source of truth (the client re-derives siblings the core already knows) and REPL gets nothing.
- **Core context rows tagged non-navigable** (the ticket's own sketch) — overcomplicated: `argDelta` *is* the discriminator, so no tag is needed.

**Navigation: NAV-C — reproduce today's teleport behaviour exactly, in the client.** `length === 1` dies once the core stops dropping, so `resolveNavigationDestination` becomes: reject unless the terminal is `R` and `inputs.length > 0`; group `matches` by key (`match[2]`) and reject unless exactly one distinct key (one selected target); then navigate to the `Δ0` row if one exists (best fit), else to the sole row iff the target is single-variant with `argDelta > 0` (single-variant surplus, e.g. `home foo` → `home`), else reject. This is provably identical to today's `matches.length === 1 && argDelta >= 0`:

- best-fit teleports (`jira PROJ`), now with the arity-2 sibling visible below;
- single-variant surplus still teleports, extra token dropped (NAV-C over the simpler `Δ === 0`, which the human chose to preserve rather than switch to "surplus shows the list");
- two matched targets never teleport (the cross-target `git`→github jump the naive `Δ0` rule would have introduced stays off);
- incomplete (`Δ < 0`) never teleports.

**Filed:** [45 — Fan out every variant; the client picks the navigable row by `argDelta`](45-fan-out-variants.md), blocking the S5 checkpoint (41) so the human reviews the final variant-display behaviour. It carries the core change (`matchesFor` stops dropping), the NAV-C client rule, and the doc/ADR/glossary amendments (new ADR 0011 superseding ADR 0008's `.$`/best-fit bullet and restating ADR 0009's nav rule; `dsl.md` §4.4/§5/§7; `CONTEXT.md` **Best fit**).
