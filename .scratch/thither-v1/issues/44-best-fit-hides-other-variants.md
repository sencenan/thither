# Should a best fit hide the target's other variants?

Type: grilling
Status: open

## Question

Found while hand-testing ticket 43. A target with variants of arity 1 and 2, given one argument, yields exactly one match — the arity-1 variant — and the arity-2 variant is nowhere in the `R`. This is core behaviour, not the client's: `dsl.md` §4.4's **best fit** says a target with a variant whose arity equals the argument count yields exactly one match, for that variant, and `matchesFor` in `src/dsl/operations/search.ts` does just that. The per-variant fan-out happens only when *no* variant fits. On the page the question rarely even arises: one match with `argDelta ≥ 0` and a non-empty `R.inputs` auto-navigates (ADR 0009), so the list is never shown for this case; it is visible in the REPL and in a live-typed query on the fallback page.

This is [ADR 0008](../../docs/adr/0008-arity-keyed-variants-and-exact-key-set.md)'s design — the argument count *selects* the variant, which is what lets `jira PROJ` go straight to `browse/PROJ` instead of stopping at a list that also offers `jira.example.com`.

Decide whether that is what we want, or whether the fallback page should still show the other variants for context when a best fit exists (e.g. dimmed, below the navigable row). If the latter:

- It is a §4.4 change: `R.matches` would carry rows that are not candidates for navigation, and today the flat list cannot say which row is the best fit versus context. Either the client infers it from `argDelta` (the only `0` row of a target) or the `R` gains structure.
- ADR 0009's rule (`R.matches` has exactly one entry) would need restating — "exactly one match with `argDelta = 0`", or a best-fit marker — so that context rows do not suppress auto-navigation.
- Live typing on the fallback page is where the extra rows would be seen; `match-list.ts` renders emitted order as-is and would need a visual distinction.

Grill: who benefits from seeing the arity-2 row when the arity-1 one already navigates? Is the cost (a two-kinds-of-row concept in the `R`, two ADR amendments) worth it, or is the REPL's terse view the only place this is even noticed?

**Done when** the human decides keep-as-is (record the reasoning here) or a build ticket is filed with the `R` shape and the ADR 0009 restatement settled.
