# Bounded history and eviction inside `.save`

Type: task
Status: open
Blocked by: 29

## Question

Deepen `.save` from the skeleton's single-element record into the bounded-history record of `browser-client.md` "Persistence" / "Bounded history", **without touching `.save`'s callers**.

In scope:

- `thither.stacks.v1` becomes an array of stacks whose **last element is the current stack** and whose earlier elements are previous stacks (history). With history limit `N`, the array holds at most `N + 1` stacks; an empty array is not a valid record; absence of the key is "no stored data".
- **Structural-difference rule** (`browser-client.md` "Bounded history"): push the previous current stack into history only when the new current stack differs from it by structural JSON equality. Ordinary searches add no entry; a mutation (or a `[A, B] → [A, B']` execution) does. `.save` still records `changed` in the register on the same comparison.
- **Eviction** removes from the **front**, trimming to `N + 1` on every write, so lowering `N` (ticket 29) evicts the oldest excess on the next save. Always preserve the current stack.
- First initialization: current stack is `[emptyState()]`; it becomes a historical entry only after the first stack-changing execution. Snapshots are the whole returned stack after its terminal `R`/`E` is popped, never mutated later.
- Keep the existing skeleton guarantees: never persist an empty stack; a sealed `E` leaves the stored record untouched.

Out of scope: quota-exceeded retry (ticket 31) and the `history()/restore()/reset()` readers (ticket 32).

**Done when** `.save` maintains the bounded-history record with structural-difference dedup and front eviction to `N + 1`, its callers are unchanged, and fixtures cite `browser-client.md` "Bounded history" (dedup on search, entry on mutation, `[A,B]→[A,B']` adds, eviction order, `N = 0`).
