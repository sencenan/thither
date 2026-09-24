# S2 checkpoint: the skeleton is usable

Type: grilling
Status: open
Blocked by: 19

## Question

Human review of the walking skeleton, running locally.

Have the human drive it by hand: set several real targets, navigate with and without arguments, hit an ambiguous query, hit a query with no matches, trigger an error, and reload to confirm replay behaves as the spec intends. Confirm the client has stayed dumb — it reads only the output register, never the returned stack; no `S` extraction, no repair — and that `.load`/`.out`/`.save` are genuinely the operations S4 will deepen rather than something S4 must tear out.

Decide: does the execution flow feel right in the hand, and does anything learned change the S4 or S5 plan?

This checkpoint **graduates the S4 fog patch** on the map into tickets, using ticket 16's architecture: bounded history with eviction and `thither.settings.v1` inside `.save`, quota-exceeded retry inside `.save`, the Web Lock around `execute` in `session.ts`, and whatever of the malformed-data / localStorage-unavailable states the skeleton has not already exercised.

**Done when** the human confirms the skeleton and the S4 tickets exist on the map, wired to their blockers.
