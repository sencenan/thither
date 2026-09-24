# The REPL composes its own program

Type: task
Status: resolved
Blocked by: 24

## Question

Make `scripts/repl.ts` a host in the [ADR 0007](../../../docs/adr/0007-hosts-compose-the-program.md) sense: it appends `.$` to every line's tokens itself, since the core no longer does. Behaviour from the user's seat is unchanged — a line searches, an empty line searches on focus alone.

In scope:

- `execute(tokens)`: build the program from `[...tokens, '.$']`. The empty-line path (`execute([])`) then runs `['.$']`, so it still searches on focus.
- Remove the two comments that cite "dsl.md §1 lifecycle step 2 … appends `.$`"; state the new rule once, or let the `'.$'` in the program speak for itself.
- The REPL keeps resuming through `execute(program, stack)` — it has no persistence operations, which is exactly the host ADR 0007 keeps the stack argument for. Do not add `.load`/`.out`/`.save` here.
- Keep the REPL's own terminal-popping and history logic as is; it is a host, so that logic is its business.

Optional, if cheap: a `:program` command or a line echo showing the composed program (`> git .$`), so the explicit epilogue is visible when teaching the language.

**Done when** `pnpm repl` runs the `dsl.md` §7 programs to the same results as before ticket 24, `pnpm typecheck` passes its third (`scripts`) pass, and `grep -n 'appends' scripts/repl.ts` finds nothing claiming the interpreter does it.

## Answer

`scripts/repl.ts` `execute(tokens)` now builds `[...tokens, '.$'].reduce(pushToken, [])` — the REPL is a host (ADR 0007) that composes its own terminal, since ticket 24 made the core evaluate exactly the program given. The empty-line path (`execute([])`) composes `['.$']` and still searches on focus alone; the §7 goldens already end in an explicit `.$`, so the composed second `.$` is absorbed on the sealed stack and results are byte-for-byte what they were before ticket 24 (verified live: `.set` → `{}` intact `argDelta:-1`; `company git MyRepo` → `.../MyRepo` `argDelta:0` navigate; empty line → search on focus).

Dropped the implicit-terminal detection (`explicitTerminal`/the ` ⤷ .$` display and `showTop`'s `implicitTerminal` param): the REPL always appends `.$` now, so there is no implicit-vs-explicit split to signal. Instead the **composed program is echoed dim** (`> company git … .set .$`) so the appended epilogue is visible when teaching — the ticket's optional line-echo, chosen over a `:program` command. Removed both comments crediting the interpreter with appending `.$` (`grep -n 'appends'` is empty). No `.load`/`.out`/`.save` added; the REPL keeps resuming through `execute(program, stack)` and keeps its own terminal-popping/history.

Landed on `main` (merge, `ticket/25-repl-epilogue` → commit `26d1c6a`). `pnpm verify` green (217 tests, boundaries clean, single-file build); all three typecheck passes pass. Unblocks 17 and 18 (the client tickets) — the frontier now opens onto the S2 walking skeleton.
