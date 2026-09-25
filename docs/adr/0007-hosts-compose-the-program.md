# Hosts compose the program; the core appends nothing

Supersedes [ADR 0006](0006-clients-resume-by-executing-on-the-persisted-stack.md) as the browser client's resumption and persistence story. `execute(program, stack?)` keeps its stack argument as a host facility (the REPL and the §7 goldens use it).

The interpreter used to append a terminal `.$` to every program unless one was already last. That was a host convenience written into the language: it forced a `hasTerminalOp` special case into `execute`, contradicted `dsl.md` §1's "evaluates the whole program as given", and — decisively — left no place for a host operation to run *after* the search, which is where persistence has to happen. Now the core evaluates exactly the program it is given, and each host wraps the user's tokens in its own **prologue** and **epilogue** of operations registered on the environment ([ADR 0005](0005-extensible-interpreter-environment.md)):

| Host | Program |
| --- | --- |
| REPL | `[...tokens, '.$']` |
| Browser client | `['.load', ...tokens, '.$', '.out', '.save']` |

The browser client's three **host operations** are the whole of its persistence:

- `.load` opens a run: clears the output register, reads `thither.stacks.v1`, validates every value of the current stack through `pushToken`, and pushes the stack (or `[emptyState()]` when the record is absent). A malformed record pushes the `parse_error` that `pushToken` produced and flags `loaded: false` in the register; an unavailable `localStorage` throws, because nothing downstream can run.
- `.out` moves the top of the stack into the **output register** when it is an `R` or `E`, and does nothing otherwise. It extracts the run's output for the host's next step; it is not a general pop.
- `.save` persists the stack as it stands — never an empty one — applying the bounded-history difference rule. A save whose write fails pushes `E(unknown_error)` and writes it into the register as the run's terminal. (It originally also recorded `changed`, a structural-difference flag the client's navigation rule consulted; [ADR 0009](0009-auto-navigate-on-a-non-empty-query.md) dropped it, along with the register's `saved` field.)

The client reads only the register afterwards; it never inspects the returned stack.

## Considered options

- **Keep the implicit `.$` and wrap it** (`.$` := search then save). No core change, but the save is the terminal's hidden second half, an explicit user `.$` behaves differently from the default one, and a save failure can only be reported by replacing the `R`.
- **Make the terminal op an environment property** (`env.terminal = '.save'`). Two kinds of terminal, and `execute` still carries a special case.
- **A storage interface owned by the client** (`store.update(fn)` wrapping read → execute → save under a Web Lock). Workable, but every rule the spec states about persistence — save before navigate, skip execution on malformed data, validate held data through `pushToken` — becomes a client obligation instead of falling out of program shape.

## Consequences

- Malformed stored data is an `E` at the head of the program: the stack is sealed, the user's tokens are absorbed, and the client renders the error — `browser-client.md`'s "skip execution, render the error" costs no client code.
- Nothing needs coordinating inside the client: `OpFn` is synchronous, `localStorage` is synchronous, so the single `interp.execute(program)` call encloses read, execute, and save. (A Web Lock around that call was specified for cross-tab serialization and later dropped as complexity out of proportion to the risk; see `browser-client.md` "Execution flow".)
- Persistence is tested through the interpreter: `execute(['.load', ...])` against a `Map`-backed `localStorage` fake, in plain Node.
- The settings actions are *not* programs. Revert and clear act on the stored record directly; import pushes the pasted values through the interpreter and writes whatever stack results as the last entry, unvalidated. (This ADR originally made reset and restore programs — `[...values, '.$', '.out', '.save']` with a `.$ .out` dry run; that design was built and dropped: a reset restores a stack, it does not search, and `.$` consumes a literal on top, so it could alter the stack being restored.)
- Host operations are ordinary symbols, so a user can type `.load` or `.out` mid-program. The epilogue always runs last, so a stray host operation cannot corrupt the final write; the behaviour is documented, not defended against.
- `dsl.md` §6's error vocabulary stays closed. Recoverable host failures reuse `parse_error` and `unknown_error`; unrecoverable ones throw and are caught once, in the client's composition root.
- The `stack` argument of `execute` is not how the browser client resumes; a host that has no persistence operations (the REPL) may still use it.
