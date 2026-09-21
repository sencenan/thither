# Implement the evaluator loop

Type: task
Status: open
Blocked by: 05, 07

## Question

Implement and test `execute(program)`'s value handling and lifecycle per `dsl.md` §1 "Transitions" and "Lifecycle", excluding the operations themselves (tickets 10–11). `execute` is a method of the env-bound interpreter and creates its own fresh empty working stack; the `Stack` is a mutable array (ticket 04's answer, [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md)).

This ticket also owns the shared **error primitives** the operations depend on, because unwinding is a §6 evaluation concern and 10/11 fail through it: the `E` constructor over the closed `ErrorType` vocabulary (in `types.ts`), and `unwind(stack)` — pop to the nearest valid `S`, retain everything below, push `E`. Operation handlers (10/11) call `unwind` when they generate an evaluation error; they do not reimplement it. Ticket 13 then *verifies* the vocabulary is complete and the not-rolled-back property holds across real operations.

Rules in scope:

- Literal accumulation: `[K, L] | x -> [K, L ++ [x]]`, and `[K] | x -> [K, [x]]` when the top is not `L`, including on an empty stack. Never lowercase, sort, or deduplicate `L`.
- `S` pushes separately; `R` pushes and stops; an explicit `E` pushes and stops **without unwinding**, so `[S, L]` followed by `E` becomes `[S, L, E]`.
- Terminal rules take priority: once `R` or `E` is on top, silently discard the rest of the parsed program.
- Lifecycle: append `.$` unless the program's last item is already the **operation** `.$` — an escaped literal `..$` does not count.
- Evaluation always starts from a fresh empty data stack.
- `.$` may occur mid-program; its result terminates evaluation, so later values never execute.
- Execution applies every item preceding the first `E`, so `git .rm @@bad` leaves `[S', E]` with the removal applied. `[S, E, E']` can never arise.

**Done when** fixtures cover the accumulation examples of §1, the three push-and-stop cases, the `..$` lifecycle distinction, the mid-program `.$`, and the discard-the-rest behaviour.
