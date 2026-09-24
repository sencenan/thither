# Register the host operations: `.load`, `.out`, `.save` (naively)

Type: task
Status: resolved
Blocked by: 16, 25

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

## Answer

Landed on branch `ticket/18-naive-persistence` as `src/client/browser-env.ts` + `src/client/tests/browser-env.test.ts`; 242 tests green, `pnpm verify` clean (boundaries: `client → dsl` through `index.ts` only).

**The seam moved during review** (two human-driven design turns past the ticket's original sketch):

1. **Operations receive the interpreter.** The ticket proposed a `getInterpreter` thunk so `.load` could reach `pushToken` before the interpreter existed. Instead the evaluator now hands every operation its interpreter as the **first** argument — `OpFn = (interp, stack) => stack` — removing the circularity at the source. The four language operations ignore it (`(_interp, stack)`); a `(stack) =>` body is no longer valid, so `set`/`rm`/`at`/`search` and the stub ops in the core tests were updated, and the direct-call operand-contract tests pass a shared `testInterp`. This **amends [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md)** (`OpFn` signature + two new consequences).
2. **`createPersistence` → `createBrowserEnv`, returning an env.** The module now mirrors the core's `defaultEnv`: `createBrowserEnv(storage): BrowserEnv` returns `defaultEnv()`'s four symbols plus the three host operations. `BrowserEnv extends InterpreterEnv, OutputRegister` — the register's fields (`terminal`/`loaded`/`saved`) are **splatted directly onto the env**, so the browser world is one value; the host operations mutate the env and the client reads those fields off it after each run. No separate persistence object, no symbol-map copying. File renamed `persistence.ts` → `browser-env.ts`.

Behaviour, exactly as specified:
- **`.load`** `(interp, stack)`: clears the register (`terminal`/`saved` undefined, `loaded: true`), reads `thither.stacks.v1`; absent → pushes `emptyState()`; a record that is not a non-empty array of arrays (including `JSON.parse` throwing) → pushes a locally-built `parse_error` and sets `loaded: false`; otherwise validates each value of the current stack through `interp.pushToken([], value)` and pushes the **canonical parsed** values (parse normalizes as it validates), stopping at the first value that parses to `E`. Storage throwing is left to throw.
- **`.out`** `(_interp, stack)`: pops the top into `env.terminal` only when it is `R`/`E`; any other top is left in place (not a general pop).
- **`.save`** `(_interp, stack)`: writes nothing on an empty stack; otherwise writes the single-element record `[stack]` and sets `env.saved = { changed }`, `changed` = `JSON.stringify` inequality vs the previous current stack (absent record = `[emptyState()]`). No history/eviction/quota retry/`thither.settings.v1` — S4 owns them and the interface needs nothing added for them.

**Design notes.** `.load` pushes with plain `stack.push` (the core's seal-aware `push` is not on the public surface, and `.load` runs first with an empty stack; a mid-program `.load` is documented, un-defended behaviour). The malformed/invalid paths need no client-side rendering logic: the pushed `E` seals the stack, the user's tokens are absorbed by the core, `.out` captures the `E`, and `.save` then finds an empty stack and writes nothing — so a bad record is left untouched, which a fixture pins. `OutputRegister` keeps explicit `| undefined` optionals for `exactOptionalPropertyTypes`; the `ThitherError` arm of `saved` is reserved for S4's `unknown_error`.

Eight fixtures cover: first-run seed+persist `[emptyState()]`; plain search `changed: false`; `.set` then reload resumes and matches the stored target with `changed: true` then `false`; malformed record → `parse_error` terminal, `loaded: false`, record byte-untouched; malformed stored value → `parse_error`, `loaded: false`; `.out` no-op on a non-terminal top; `.save` no-op on empty stack; unavailable `localStorage` throws through `.load`.
