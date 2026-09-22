# Finish the evaluator loop: the terminal seal

Type: task
Status: resolved
Blocked by: —

## Question

Complete `src/dsl/interpreter.ts` to the `dsl.md` §1 lifecycle and §6 error model. The loop today accumulates literals, dispatches operations by name, and appends a terminal `.$`; it is missing the stop conditions and the error primitives.

**Terminal short-circuit (§1 steps 4–5, §7).** Stop evaluation as soon as an `R` or an explicit `E` reaches the top of the stack, discarding the remaining program. `S0 git .$ S1 docs .$` must stop at `[S0, R]`, with `S1` never pushed and the second search never run. Pushing an explicit `E` stops **without** unwinding, so `[S, L]` followed by an explicit `E` becomes `[S, L, E]`.

**Error primitives + unwinding (§6).** Provide the `E` constructor and the unwind step that operations fail *through*. On a **generated** evaluation error: pop until the nearest valid `S` is on top (retaining everything below it), push `E`, and stop — `[S0, L0, S1, L1] → [S0, L0, S1, E]`, and `[L] → [E]`. Unwinding never inspects or rewrites values below the retained `S`, and earlier successful operations are **not** rolled back.

Watch the trap the earlier evaluator hit: a sigil alone cannot identify a stack value — accumulating the tokens `S x` builds `["S", "x"]`, which unwind must not mistake for a state; check the body shape too (and `as` is banned; route the impossible through `invariant`).

**Done when** fixtures cover: stop-at-first-`R` (`S0 git .$ S1 docs .$`), explicit-`E` pushed as-is, and a terminal value sealing the stack against trailing literals/values. Uses **stubbed** operations that model operand inspection, since the real operations arrive in 12/13.

## Answer

Resolved as a **terminal seal**, not an unwind step — a design shift settled with the human across this session.

**Unwind dropped entirely.** The §6 unwind-to-nearest-`S` shape is a *consequence of how each operation is written*, not an interpreter mechanism: an operation that **peeks** its state and consumes only its transient `L` operand leaves `[K, S]` in place, so pushing `E` on failure yields `[K, S, E]` for free. `[S0,L0,S1,L1] .set → [S0,L0,S1,E]` and `[L] → [E]` both fall out of peek-not-pop. A shared `unwind` would only re-search for an `S` the operation already located, and would tempt the mutate-then-fail that §6 forbids. So unwind, `isState`, and the not-rolled-back fixture **move to tickets 12/13** as the operation contract.

**The seal lives in one private `push`.** `push(stack, value)` owns both rules for what an incoming value does to the top of the stack: (1) once an `R` or `E` is on top the stack is *sealed* and nothing further lands; (2) a literal array merges into the `L` already on top or starts a new one. The evaluate loop routes `case 'l'` and `case 'S'|'R'|'E'` through `push`; operations run **unconditionally** (`stack = fn(stack)`) and stay unaware of the seal — a trailing `.$` on `[S, E]` runs, finds no operand, and its `E'` is absorbed by `push`, leaving `[S, E]`. No special-case control flow, no `break`; the whole program is consumed.

**Contract for 12/13:** real operations must **peek-not-pop** their state and add through the seal-aware `push`, so a doomed op on a sealed stack is absorbed rather than corrupting it.

Fixtures (via `pushToken`/`execute` only, `push` unexported): R seals `S0 git .$ S1 docs .$` (second `.$` still dispatched, output absorbed); explicit `E` pushed as-is → `[S, L, E]`; `E` seals against a trailing literal; unparsable first item → `[E]`. Landed alongside the human's broader core refactor (`utils.ts`, renamed `lint` scripts). 41 tests green; `verify` clean.
