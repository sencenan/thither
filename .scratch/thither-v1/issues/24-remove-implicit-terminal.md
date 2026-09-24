# Remove the implicit terminal from the core

Type: task
Status: resolved
Blocked by: —

## Question

Make `execute` evaluate exactly the program it is given, per [ADR 0007](../../../docs/adr/0007-hosts-compose-the-program.md) and the amended `dsl.md` §1 Lifecycle step 2. Core only; the REPL follows in [ticket 25](25-repl-epilogue.md) and no browser-client work starts before both land.

The public signature does not change — `execute(program, stack?)` stays, `index.ts` stays — but its contract does: the interpreter appends nothing, so a program without `.$` ends with whatever is on the stack, and an explicit `.$` is never doubled. `browser-client.md` "Core interface" already states the new contract.

### Code

- `src/dsl/interpreter.ts`: delete the `TERM_OP` append, `hasTerminalOp`, and the program copy that existed only to receive the appended item. The stack copy stays (ADR 0006's non-mutation guarantee for the caller's stack still holds).
- `src/dsl/types.ts`: `TERM_OP` loses its last core consumer outside `env.ts`. Move it into `env.ts` as the local name `defaultEnv` binds `search` to, or inline `'.$'` there — whichever leaves `types.ts` holding only the type algebra.

### Tests (all through `index.ts` / the existing harnesses)

- `src/dsl/tests/interpreter.test.ts`: replace the `describe('execute — terminal .$ appending')` block with fixtures for the new rule — a program with no `.$` ends in `[S, L]` (the literal array survives to the top); an explicit trailing `.$` runs exactly once; `..$` remains a literal. Drop the identity-`.$` stubs that existed only to absorb the appended operation where they are no longer needed.
- `src/dsl/tests/golden.test.ts`: every §7 program ends in an explicit `.$`, matching the amended `dsl.md` §7 exactly (the "Create and search" program is now `… .set .$`; "Select every target with an empty query" is `S .$`). Rewrite "execute leaves the program reusable": it should assert `execute` does not mutate `program` and that two runs give equal stacks — the old third step (appending a literal after a run) tested the append itself and goes.
- `src/dsl/tests/operators.test.ts`, `src/dsl/operations/tests/harness.ts`, `src/dsl/operations/tests/search.test.ts`: append `.$` to programs that expected the implicit one; remove the harness's identity `.$` if nothing binds it any more.

Not in scope: `scripts/repl.ts` (ticket 25), the browser client, any change to the four language operations.

**Done when** `pnpm verify` is green, the §7 goldens match the amended `dsl.md` exactly, `grep -rn TERM_OP src/dsl/interpreter.ts src/dsl/types.ts` finds nothing, and the REPL is *known broken* until ticket 25 (its programs no longer search) — say so in the commit message rather than patching it here.

## Answer

Done on branch `ticket/24-remove-implicit-terminal` (`3083fa3`); `pnpm verify` green, 217 tests.

**Core.** `src/dsl/interpreter.ts` now iterates `program` directly — the `hasTerminalOp` check, the `TERM_OP` append, and the program copy that only received it are gone; the stack copy stays (ADR 0006 non-mutation). `src/dsl/types.ts` dropped `export const TERM_OP`, so it holds only the type algebra; `src/dsl/env.ts` binds `search` under the inline literal `'.$'` instead. `grep -rn TERM_OP src/dsl/interpreter.ts src/dsl/types.ts` finds nothing (the symbol is gone from `src/` entirely).

**Tests, all through the existing harnesses.** `interpreter.test.ts`: the `terminal .$ appending` block became `evaluates exactly the program given` — a no-`.$` program ends `[S, L]` and the search stub is never called; an explicit trailing `.$` runs once; `execute` doesn't mutate the program; `..$` stays a literal. One assertion corrected against the current core: escapes are stored **verbatim**, so `..$` accumulates as `['L', ['..$']]` (resolving to `.$` only on use), not `['L', ['.$']]`. `golden.test.ts`: every §7 program ends in an explicit `.$` matching the amended `dsl.md` §7 (`… .set .$`, empty query `S .$`); the reuse test now asserts non-mutation + equal-across-two-runs and drops the append-a-literal-after-a-run step that tested the append itself. `operators.test.ts`: the two `.$`-searching cases gained an explicit `.$` (the `.set`/`.rm`/`.@` cases already assert the post-operation state, so were untouched). `operations/tests/harness.ts`: dropped the no-op identity `.$`. `operations/tests/search.test.ts`: its `run` helper now closes each program with `.$` itself, as a host does.

**REPL left known-broken** (`scripts/repl.ts` still composes programs without `.$`) — recorded in the commit message, fixed in ticket 25 per the core → REPL → client sequencing.
