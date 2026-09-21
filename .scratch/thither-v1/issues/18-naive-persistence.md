# Persist the stack, naively

Type: task
Status: open
Blocked by: 16

## Question

Implement the smallest persistence that makes the skeleton executable end to end, behind the storage interface designed in ticket 16 — so that S4 can deepen it without changing callers.

In scope:

- Read the current persisted stack from `localStorage` at `thither.stacks.v1`; when the record is absent, take `initialStack()` as the current stack.
- Copy the **final value** of that stack without modifying the stored snapshot, per ADR-0003. If the stack is empty, append no leading item and do not synthesize a state value.
- After execution, persist the entire remaining stack once the terminal `R` or `E` has been popped: `[S0, S1, R]` persists as `[S0, S1]`, and `[S, E]` persists as `[S]`. Terminal values never enter a stored snapshot.
- Save before navigating.
- Write the record in the shape S4 will extend — the flat array of stacks whose last element is the current stack — even though this ticket keeps exactly one element.

Explicitly **not** in scope, and left to S4: bounded history and the difference rule, eviction, `thither.settings.v1`, Web Locks, quota-exceeded retry, and the malformed-data and localStorage-unavailable error states. Do not hand-roll interim versions of these — leave them unimplemented so the S4 tickets own them.

**Done when** a program executes, its remaining stack persists, and the next execution resumes from the stored final value, with tests at the storage interface.
