# Implement errors and state preservation

Type: task
Status: open
Blocked by: 10, 11

## Question

Verify error construction and unwinding compose correctly across the real operations, per `dsl.md` §6. The primitives themselves — the `E` constructor and `unwind(stack)` — are delivered by ticket 09, and the closed `ErrorType` union lives in `types.ts` (ticket 04's answer); this ticket proves they are complete and correct once 10/11 exist.

The closed `type` vocabulary — `parse_error`, `invalid_value`, `invalid_destination`, `missing_dimensions`, `ambiguous_set`, `invalid_stack` — each paired with a human-readable `description`. Map every failure condition in the spec onto exactly one type. Adding a type is a specification change, so if a condition fits none of them, raise that on this ticket rather than inventing one.

**Unwinding** on a generated evaluation error: pop until the nearest valid `S` is on top, retaining everything below it, then push `E` and stop. `[S0, L0, S1, L1]` becomes `[S0, L0, S1, E]`. With no `S` anywhere, `[L]` becomes `[E]`. Unwinding never inspects or rewrites values below the retained state.

Crucially, earlier successful operations are **not** rolled back: the retained state is the nearest working state at the point of failure, not the initial state. Verify with the spec's own case — focus set by `.@`, cleared by a second `.@`, then an ambiguous `.set` fails — where the retained state has the cleared focus.

An explicit `E` value is not a generated failure: push it and stop without unwinding.

**Done when** each error type has a fixture producing it, the unwinding examples are fixtures, and the not-rolled-back property is tested explicitly rather than assumed.
