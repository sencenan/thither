# Break score ties by key length, then representative destination length

Refines `dsl.md` §3 and §5's match ordering. Supersedes [ADR 0008](0008-arity-keyed-variants-and-exact-key-set.md)'s "tie order among equal scores is not something we promise" and the target-set-order-only tiebreak. Display ordering only: client navigation ([ADR 0009](0009-auto-navigate-on-a-non-empty-query.md), [ADR 0011](0011-fan-out-variants-client-picks-navigable.md)) is unchanged.

The matcher's score ignores a key's unmatched tail: fzf scores the matched characters' positions and bonuses, not how much of the key is left over. So every target a prefix query hits ties on score — `git` scores `git`, `gitlab`, and `githubprojects` identically (80 each), and `do` scores `do`, `docs`, and `domain` identically. Score ties are therefore not a rare corner but the **normal case for any shared-prefix query**, and until now the winner of such a query was decided purely by target-set order — the order the targets happened to occupy in the map. An exact key (`git`) did not beat a longer neighbour (`gitlab`); whichever was defined first led.

That contradicts the user's mental model. Having typed and committed a query, the user has said as much as they mean to; the target whose key is *shortest* is the one most fully accounted for by what was typed, and the one they most likely meant. A longer key carries characters the query never mentioned. This is also fzf's own default (`--tiebreak=length`), which the selector disables (`sort: false`, so we can impose target-set order on ties) — we are restoring the length heuristic on top of our own ordering.

## The decision

Order selected targets by, in sequence:

1. **`hint.score` descending** — unchanged.
2. **Key length ascending.** On equal scores, the shorter key leads.
3. **Representative-destination length ascending.** On equal score and key length, the shorter representative destination leads. A target's **representative destination** is the rendered destination of the row a client would navigate to — its best fit (the `argDelta 0` row), or its sole row when the target is single-variant — or, when no row is navigable, the shortest of its rendered destinations. This keeps display order honest about where each group would send the user.
4. **Target-set order** — the final, display-only tiebreak, as before, for targets equal on all of the above.

The rows *within* a target still order by `argDelta` (dsl.md §5), and a target's rows stay contiguous. The tiebreaks compare whole targets; step 3 borrows the one row that represents each.

**Navigation is untouched.** `resolveNavigationDestination` still teleports only for a *single* selected target with a navigable row; any query selecting two or more targets shows the list and never guesses. The tiebreaks change only the order of that list — they never turn an ambiguous result into a navigable one. So the headline case `git` (matching `git`/`gitlab`/`githubprojects`) now lists `git` first but still does not teleport.

## Considered options

- **Teleport to the tiebreak winner.** Rejected. It would flip "two matched targets never teleport" (ADR 0009/0011) into "teleport when one key is the tightest fit," silently sending the user somewhere on a guess. The tiebreak's job is to order the list the user is looking at, not to decide navigation.
- **Key length only (drop the representative-destination step).** Simpler, and the destination step almost never fires (it needs two equal-length keys tying on score). Rejected only because keeping it makes the order total and deterministic and keeps display order consistent with where each target points, at negligible cost.
- **Representative = shortest rendered destination across all variants.** Rejected per the pin-2 discussion: a target's shortest rendering can belong to a partial (`argDelta < 0`) row it would never navigate to, so ranking by it would advertise a destination the user cannot reach. The representative is the navigable row when there is one.
- **Leave target-set order as the sole tiebreak.** The status quo. Rejected: it makes the most common query shape (a shared prefix) depend on definition order, and lets a longer key beat an exact one.

## Consequences

- Any shared-prefix query reorders: the exact/shortest key leads. `git` lists `git`, `gitlab`, `githubprojects`; `do` lists `do`, `docs`, `domain`.
- An empty query (every target ties on score 0) now lists shortest keys first, then falls to target-set order among equal-length keys. The `dsl.md` §7 "empty query" worked example and its golden reorder `docs` ahead of `company git`.
- Equal-length keys tying on score (e.g. the `t01`…`t11` fallback-page fixture) are unaffected: they still fall to target-set order.
- The change lives in `search.ts`'s cross-target sort plus a representative-destination helper; `selector.ts`, the client, and navigation are untouched.
- `dsl.md` §3 and §5 (match ordering, the "preserve ambiguity" and "empty query" examples) are amended; `search.test.ts` and `golden.test.ts` pin each tiebreak.
