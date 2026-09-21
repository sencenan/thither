# S2 checkpoint: the skeleton is usable

Type: grilling
Status: open
Blocked by: 19

## Question

Human review of the walking skeleton, running locally.

Have the human drive it by hand: set several real targets, navigate with and without arguments, hit an ambiguous query, hit a query with no matches, trigger an error, and reload to confirm replay behaves as the spec intends. Confirm the client has stayed dumb — no language-type inspection, no `S` extraction, no repair — and that the storage interface is genuinely the one S4 will deepen rather than something S4 must tear out.

Decide: does the execution flow feel right in the hand, and does anything learned change the S4 or S5 plan?

This checkpoint **graduates the S4 fog patch** on the map into tickets, using ticket 16's architecture: the versioned records, bounded history with the structural-difference rule and eviction, Web Locks serialization, quota-exceeded fallback, and the malformed-data and localStorage-unavailable error states.

**Done when** the human confirms the skeleton and the S4 tickets exist on the map, wired to their blockers.
