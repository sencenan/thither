# S4 checkpoint: persistence is durable

Type: grilling
Status: open
Blocked by: 30, 31, 32

## Question

Human review of the deepened persistence, running locally.

Have the human drive it by hand: perform a mutation and confirm the previous stack becomes a history entry; perform ordinary searches and confirm they add no entry; drive enough mutations to force eviction at the default limit and at `N = 0`; lower the limit and confirm the oldest excess evicts on the next save; simulate a quota overflow and confirm evict-and-retry then `unknown_error`; and exercise `history()`/`reset()`/`restore()` directly (the modal is S5), confirming a reset/restore that yields `E` leaves the stored record untouched.

Confirm the deepening stayed inside the three host operations — `.save`'s caller (`main.ts`, since ticket 34 collapsed `session.ts` into it) is unchanged — and that nothing S4 built has to be torn out at S5.

Decide: does durable persistence behave as the spec intends, and does anything learned change the S5 plan?

This checkpoint **graduates the S5 fog patch** on the map into tickets, using ticket 16's architecture and ticket 32's readers. Expected to open with a `prototype` ticket on layout and highlight presentation.

**Done when** the human confirms persistence and the S5 tickets exist on the map, wired to their blockers.
