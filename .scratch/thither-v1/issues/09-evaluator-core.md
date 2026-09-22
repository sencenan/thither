# Implement the evaluator loop

Type: task
Status: resolved
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

## Answer

Three modules under `src/dsl/lib/`, all DOM-free leaves over `types.ts`:

- **`evaluator.ts`** — `execute(program, symbols)`: appends the terminator unless the last item is already `["op", ".$"]`, then folds left over a freshly created empty stack, checking for a terminal top *before* each item so `[K, R]`/`[K, E]` discard the remainder. Literals and separators accumulate; `S`/`R`/`E` push; `["op", name]` dispatches through the symbol map. It is a free function, not yet a method: ticket 14 owns the `createInterpreter` assembly that binds it, so `index.ts` is untouched here.
- **`stack.ts`** — `isState`, `isTerminal`, `isLiteralArray`, shared with tickets 10 and 11.
- **`errors.ts`** — `thitherError(type, description)` and `unwind(stack, error)`.

### The separator needed a home on the stack (type-model amendment)

§1's transition table has no row for the standalone `.`, but §2 and §4 require it: the first separator divides an input into a **matching portion** and a **suffix**, and operations are handed nothing but the stack. Ticket 04's `LiteralArray = readonly Literal[]` had nowhere to record it.

Resolved by making **the separator a literal**, so the existing `LiteralArray` carries it and no parallel type is needed:

```ts
export type Separator = readonly ["."];
export type Literal = Dim | Template | Separator;
export type LiteralArray = readonly Literal[];
```

It is a tuple rather than the text `"."` so it cannot be confused with the literal that `..` escapes to, and it reuses the `["."]` program-item shape, so the evaluator accumulates the item it was handed. `StackValue` is unchanged.

Rejected: splitting `L` into `{ matching, suffix }` fields, because operations still need the *whole* list — `.set` takes the last literal of the full array as its destination, per §4.1's worked example `S company git . ignored https://… .set`; and a sentinel *string* element, which is forgeable only via a fake brand and collides with the escaped `.`.

### The sigil alone cannot identify a stack value

`L` is the one stack value that is not a `["sigil", body]` envelope, and its elements are strings, so accumulating the literal tokens `S x` builds `["S", "x"]` — element 0 identical to a state envelope's. `unwind` scanning for "the nearest valid `S`" would have stopped on it. The predicates in `stack.ts` therefore check the *body*: an envelope's is a plain object, while a literal array's element 1 is a string, a separator tuple, or absent. Fixtured in `errors.test.ts`.

That collision is also why the predicates exist at all rather than inline `value[0] === "S"` checks: with a bare array in the union TypeScript refuses to narrow (`TS2339`), and `as` is banned by the standards.

### Other decisions

- **`unwind(stack, error)`, not `unwind(stack)`** — the ticket's signature omitted the `E` it has to push. Operations call `unwind(stack, thitherError("ambiguous_set", "…"))`.
- **An unbound operation is an `invariant`, not an `E`** — `append` already rejects a dot-token the environment does not bind (`parse_error`), so reaching dispatch with an unknown name means the program was not built by this interpreter: exactly the "types say it cannot happen" case. §6's vocabulary has no type for it.
- The private `parseError` helpers in `token-parsing.ts` and `structured-value.ts` were **left alone**; folding them into `thitherError` is available as a follow-up.

164 tests green; `check`, both `typecheck` passes, `lint:boundaries`, and `build` all clean. Unblocks 10 (with 06 and 08) and 11 (with 08).

### Noticed, not fixed

- Ticket 13 still lists the **stale** error vocabulary (`invalid_value`, `missing_dimensions`, `invalid_stack`), which commit `947c3d7` corrected in `types.ts`. Reword it to §6's four types before claiming it.
- `pnpm run <script>` currently aborts before running anything: its pre-run dependency check wants `esbuild` added to `allowBuilds` in `pnpm-workspace.yaml`. Verification for this ticket was run by invoking the five tools directly.
