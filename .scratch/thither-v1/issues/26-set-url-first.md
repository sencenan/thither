# `.set` reads the destination as its first literal

Type: task
Status: resolved

## Question

Usability: when creating a shortcut from the browser, the destination URL is
what you already have in hand, so it should lead the `.set` program and let you
append dimensions after it. Today `.set` takes the **last** literal of `L` as the
destination, forcing a cursor round-trip to prepend dimensions before the URL.

Flip the convention so the destination is the **first** literal:

```
S https://github.com/company/{} company git .set
```

In scope:

- `src/dsl/operations/set.ts`: take the first literal as the destination
  (`shift`, not `pop`); keep the separator/suffix split on what remains. The
  first literal is the destination unconditionally, whatever it looks like.
- `docs/dsl.md`: �§4.1 step 1 ("first literal … do not search forward"), the �§4.1
  example and its prose, �§6's "first literal … unconditionally" note and its
  missing_operand / unwinding examples, and the �§7 "Create and search" program.
- Tests: `operations/tests/set.test.ts`, `tests/golden.test.ts`,
  `tests/operators.test.ts` — move the URL to the front of every `.set` program.
- `scripts/repl.ts` usage comment and `docs/browser-client.md` `.set` examples.

**Done when** `pnpm verify` is green and every `.set` example in spec, tests,
REPL, and browser-client doc leads with the destination.

## Answer

`.set` now takes the **first** literal of `L` as the destination: `src/dsl/operations/set.ts` shifts instead of popping, and the separator/suffix split runs on the remainder unchanged. The first literal is the destination unconditionally, so a non-URL leading literal is `invalid_destination` and `.set` never searches forward for a URL. The canonical form is now `S https://github.com/company/{} company git .set`.

Updated `docs/dsl.md` (§4.1 step 1, the §4.1 example + prose, §6's "first literal … unconditionally" note and its missing_operand/unwinding examples, and the §7 "create and search" program), the `.set`/golden/operators/at tests, the `scripts/repl.ts` usage comment, and the `docs/browser-client.md` `.set` example. `pnpm verify` is green (217 tests, boundaries clean, single-file build) and the REPL runs the new URL-first order live.
