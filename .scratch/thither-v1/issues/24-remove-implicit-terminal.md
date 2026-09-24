# Remove the implicit terminal from the core

Type: task
Status: open
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
