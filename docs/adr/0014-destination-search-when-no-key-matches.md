# Destination search when no key matches

Amends `dsl.md` §4.4's "if no nonempty prefix matches, return no matches" and §5's matching evidence, and adds an exception to client navigation ([ADR 0009](0009-auto-navigate-on-a-non-empty-query.md), [ADR 0011](0011-fan-out-variants-client-picks-navigable.md)).

A query that selects no target by key used to end in an empty result, even when the user typed something plainly present in a destination: `browse` names nothing in a key `jira`, but it is right there in `https://jira.example.com/browse/{}`. We decided that `.$`, when its key search yields no matches, runs a second pass — **destination search** — matching the same query against each variant's destination template, and reports what it finds as ordinary matches whose evidence says it came from the destination.

## The decision

- **Trigger.** Destination search runs exactly when the key search produced no matches. No other condition is added: whatever query the key search ran, destination search runs.
- **Query.** The same query: focus followed by the matching portion, operators live. Focus gets no special treatment.
- **Boundary.** With a separator, the suffix is still arguments and is applied to every destination match. Without one, the inferred-boundary search has already found no matching prefix, so every literal is matching input and there are no arguments.
- **Haystack.** Each variant's **raw template** is matched on its own, `{}` included. Only the variants whose template matched are emitted; a matched target's other variants are not.
- **Evidence.** Every hint carries `on: 'key' | 'destination'`. For a destination match, `positions` index the variant's template and `score` is the matcher's real score against it.
- **Ordering.** Section 5's pipeline, unchanged: a target's score is its best variant's score, its rows stay contiguous and order by `argDelta`, and the length tiebreaks follow.
- **Navigation.** A result with destination evidence never auto-navigates. The fallback page shows it; a click, a shortcut, or Enter opens a row as usual.

## Considered options

- **Signal destination evidence with `score: 0` and non-empty `positions`.** The first sketch. Rejected: `positions` would change meaning depending on another field, `score: 0` already means "empty query, no evidence", and it would discard the matcher's score, which ordering needs. An explicit `on` field says what it means.
- **Match the rendered destination instead of the template.** Rejected: the user's own arguments would then become evidence. The template is what the user stored.
- **Match one string per target (all variants joined).** Rejected: positions would need remapping into each variant, and a variant that did not match would be listed with evidence it does not have.
- **Keep focus to keys and match only the typed literals against destinations.** Rejected for least surprise: destination search is the same query against a different haystack, nothing more.
- **Navigate destination matches under the ordinary rule.** Rejected: fuzzy matching over URLs is loose, and a query that named no key should be confirmed by eye before the client leaves the page.

## Consequences

- An `R` produced by `.$` now always carries `on` in every hint. A persisted `R` written before this change has none; the parser reads a missing `on` as `'key'`, since that was the only evidence that existed.
- `R.inputs` is unchanged: the matching literals, whichever pass found the matches.
- A query that matches neither a key nor a destination still yields no matches, and still reports its attempted inputs.
- The client highlights destination evidence in the destination, in its own colour, and the summary bar says no key matched.
