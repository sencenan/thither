# Assemble the public surface and golden §7 programs

Type: task
Status: resolved
Blocked by: 12, 13

## Question

Expose the core's public interface and prove it against the worked programs of `dsl.md` §7 as end-to-end golden tests.

**Surface.** `defaultEnv()` — preloads the four operations `.set`/`.rm`/`.@`/`.$` and the seed initial stack (one state value with no targets and empty focus) — and `createInterpreter(env)`, both exported from `src/dsl/index.ts`, the repo's sole barrel (adding an export there is a specification change per `code-standards.md`). Nothing internal leaks.

**Reconcile the interface with the docs.** The rewrite currently exposes `pushToken` (mutating) and lacks `emptyProgram`/`initialStack`, while [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md) and `browser-client.md` name `append` / `emptyProgram` / `initialStack`. Settle the final names and shape, and make code and docs agree **in the same commit** — the client tickets (16+) build against whatever this ticket lands. The program is internal and may be mutable (that doc claim was already dropped); this is about the entry points a client actually calls.

**Golden tests (§7).** All five worked programs produce exactly the stacks and JSON shown: create-and-implicitly-search; navigate-with-inferred-arguments; preserve-ambiguity-when-arguments-missing; select-every-target-with-empty-query; stop-at-first-result. Plus a totality property: no sequence of arbitrary strings makes appending or executing throw.

**Done when** the five golden programs match `dsl.md` §7 exactly, the public interface is reconciled with the docs (code amended, or docs amended to match, in one commit), and the core is importable by the client with no client-specific concern inside it.

## Answer

Implemented on branch `ticket/14-public-surface-and-golden`. `src/dsl/index.ts` now exports `createInterpreter`, `defaultEnv`, `emptyState`, and the type algebra a client reads; `src/dsl/tests/golden.test.ts` holds the five §7 goldens plus the totality property, all through the barrel. 123 tests green; boundaries clean.

**The surface, reconciled toward the code, not the docs.** The rewrite's `pushToken` and `{ symbols }` environment already met the requirements; the doc-side `append`/`emptyProgram`/`initialStack` trio was ceremony from the ADR 0003 resume model. Settled shape:

```ts
defaultEnv(): InterpreterEnv          // { symbols: .set .rm .@ .$ }
createInterpreter(env): Interpreter   // { pushToken(program, item), execute(program, stack?) }
emptyState(): State                   // ['S', { targets: [], focus: [] }]
```

- **`pushToken` stays, program is mutable.** It appends in place and returns the program, so the `reduce` idiom is `tokens.reduce(interp.pushToken, [])`. A shared `emptyProgram` property would have accumulated across executions once mutation was accepted, so it is gone: the empty program is `[]`. `execute` still appends the implicit `.$` into the caller's program (idempotently, via `hasTerminalOp`); accepted as benign since clients rebuild the program per run.
- **`execute(program, stack = [])` — resumption is a stack argument.** The interpreter shallow-copies the supplied stack (`[...initial]`) so the persisted snapshot is never mutated by operations' `pop`/`push`; held values are `readonly`, so a shallow copy suffices. This **supersedes ADR 0003**: [ADR 0006](../../../docs/adr/0006-clients-resume-by-executing-on-the-persisted-stack.md) records that the program now carries only input tokens and the client passes its whole current stack, so `[A, B]` resumes to `[A, B']` rather than `[B']`.
- **`emptyState()` replaces `initialStack`.** An empty stack is *not* a usable seed: `.set` and `.$` on a stack with no `S` are `missing_operand` by §6, so a first-run user could never create a target. The seed state is still required; it just lives as one exported helper the client calls to build `[emptyState()]`, keeping the client ignorant of the `S` shape. A fresh value per call, since `State.targets` is a mutable array; lives in `src/dsl/utils.ts` beside `thitherError`, the other value constructor, so `interpreter.ts` stays the evaluation loop alone.
- **`defaultEnv()`** is a new root file `src/dsl/env.ts`, the one place operations are wired (root files may import `operations/`; the cruiser rule held).

**Open question handed to ticket 16.** ADR 0003 validated persisted state for free because it passed through `pushToken`. With the stack argument, `execute` does not re-validate its input: a corrupted or hand-edited localStorage record lands on the working stack as-is, and an operation reading `state[1].targets` from garbage could throw. Detecting an unreadable record is now explicitly a client design decision (`browser-client.md`'s malformed-data error state), recorded as a consequence in ADR 0006. Reset JSON is still validated value by value through `pushToken`.

**Goldens (§7).** All five worked programs assert the exact stacks the spec shows: create-and-implicitly-search (exact, including `positions: []`/`score: 0`); navigate-with-inferred-arguments and preserve-ambiguity (`objectContaining` on `hint` where the spec elides `positions`/`score`); select-every-target (exact); stop-at-first-result (`[S0, R]`, `S1` never pushed). One extra case runs the first golden seeded through the stack argument instead of a program item and asserts the caller's array is untouched.

**Totality.** A seeded `mulberry32` generator (no new dependency) draws 500 programs of 0–11 items from a 36-item alphabet covering every parse branch — separator, `..`/`...`/`..$` escapes, all four bound operations, an unbound one, empty/whitespace tokens, templates, URLs, `javascript:`, `$&`, Unicode, JSON-as-string, valid and malformed `S`/`R`/`E` envelopes, a stray `L`, and non-envelope junk (`null`, `undefined`, numbers, `{}`, `[]`, `['S']`) — half seeded with `[emptyState()]`, half empty. `pushToken` and `execute` never throw; the failing sequence is printed on failure for reproduction.

**Docs amended in the same commit:** `browser-client.md` (Core interface, Execution flow renumbered to four steps, reset validation, bounded-history first-run and `[A, B]` note), ADR 0005 (`append`→`pushToken`, `OperationFn`→`OpFn`, seed/`emptyProgram` consequence), ADR 0003 marked superseded, new ADR 0006, `dsl.md` §2 (`pushToken(program, item) -> program`), `code-standards.md` (barrel contents, `pushToken` contract, `Program` named as a mutation carve-out beside `Stack`), `docs/agents/domain.md` tree.

Unblocks 15 (S1 checkpoint).
