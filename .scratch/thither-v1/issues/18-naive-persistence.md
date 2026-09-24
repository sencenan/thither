# Register the host operations: `.load`, `.out`, `.save` (naively)

Type: task
Status: open
Blocked by: 16, 24

## Question

Implement the browser client's three host operations as designed in [ticket 16](16-client-architecture-and-seams.md) and recorded in [ADR 0007](../../../docs/adr/0007-hosts-compose-the-program.md), in `src/client/persistence.ts`, so the skeleton can execute end to end and S4 deepens the same three operations without touching their callers.

`createPersistence({ storage, interp }): { symbols: Map<Op, OpFn>; register: OutputRegister }` — `storage` is the `getItem`/`setItem`/`removeItem` surface of `localStorage`, injected so tests use a `Map`-backed fake; `interp` is the interpreter the symbols are registered into (the closure resolves it at call time, so `main.ts` can create the env, register, then build the interpreter).

In scope, per `browser-client.md` "Host operations":

- `.load`: clear the register; read `thither.stacks.v1`; absent → push `emptyState()`; present → shape-check (non-empty array of arrays), validate each value of the **current stack** (last element) via `interp.pushToken([], value)`, push the stack on success; on failure push the `parse_error` `pushToken` produced (or one built for a bad record shape) and set `register.loaded = false`. `storage` throwing → let it throw.
- `.out`: if the top is an `R` or `E`, pop it into `register.terminal`; otherwise leave the stack alone.
- `.save`: if the stack is empty, write nothing. Otherwise write the record as the flat array of stacks whose last element is the current stack — **exactly one element** for now — and set `register.saved = { changed }` where `changed` is JSON structural inequality between the previous current stack (absent record counts as `[emptyState()]`) and the new one. Do not implement history, eviction, quota retry, or `thither.settings.v1`; S4 owns them, and the interface has nothing to add for them.
- `register` type: `{ terminal?: Result | ThitherError; loaded: boolean; saved?: { changed: boolean } | ThitherError }`.

Tests run **through the interpreter**: `defaultEnv()` plus the symbols, then `execute(['.load', ...tokens, '.$', '.out', '.save'].reduce(pushToken, []))` against the fake storage. Fixtures: first run seeds and persists `[S]`; a `.set` then a reload resumes from the stored stack; a plain search leaves `changed: false`, a mutation `changed: true`; malformed record → terminal is `parse_error`, `loaded: false`, record untouched; `.out` on a non-terminal top is a no-op; `.save` on an empty stack writes nothing.

**Done when** those fixtures pass in plain Node with no DOM, and `src/client/persistence.ts` is the only client module that names `thither.stacks.v1`.
