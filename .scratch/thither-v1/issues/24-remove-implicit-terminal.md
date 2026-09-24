# Remove the implicit terminal from the core

Type: task
Status: open
Blocked by: —

## Question

Make `execute` evaluate exactly the program it is given, per [ADR 0007](../../../docs/adr/0007-hosts-compose-the-program.md) and the amended `dsl.md` §1 Lifecycle: no appended `.$`, no `hasTerminalOp` special case, no copy of the program (the stack copy stays).

In scope:

- `src/dsl/interpreter.ts`: drop the terminal append and `hasTerminalOp`. `TERM_OP` may remain as the name `defaultEnv` binds `search` to, or be inlined — whichever leaves `types.ts` honest.
- `src/dsl/tests/golden.test.ts` and any fixture that relied on the implicit `.$`: append `.$` explicitly. The §7 worked programs in `dsl.md` now end in `.$`; the goldens must match them exactly, as before.
- `scripts/repl.ts`: append `.$` to each line's tokens before executing — the REPL is a host, so the epilogue is its job.
- A fixture proving the new rule: a program with no `.$` ends in whatever is on the stack (`[S, L]`), and an explicit trailing `.$` is not doubled.

Not in scope: the browser client's host operations (ticket 18) and any change to the four language operations.

**Done when** `pnpm verify` is green with the goldens matching the amended `dsl.md` §7, the REPL behaves as before from the user's seat, and `grep -rn TERM_OP src/dsl/interpreter.ts` finds nothing.
