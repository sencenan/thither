# Introduce `thither.settings.v1` and the history limit

Type: task
Status: resolved
Blocked by: 20

## Question

Add the `thither.settings.v1` record and the history-limit value that ticket 30's eviction will consume, per `browser-client.md` "Persistence" / "Bounded history".

In scope:

- Make the persistence module (currently `src/client/browser-env.ts`) the sole namer of `thither.settings.v1`, alongside `thither.stacks.v1`.
- `thither.settings.v1` holds configuration only, never language stack values: `{ "historyLimit": 10 }`. Read it with the default `historyLimit` of **10** when the key is absent or malformed.
- Validate `historyLimit` as a **nonnegative integer**; `0` is legal (retain only the current stack). Reject non-integers / negatives back to the default rather than throwing.
- Expose a read path the `.save` deepening (ticket 30) uses to obtain `N`, and a write path the S5 settings modal will later call. No history append or eviction here — this ticket only lands the setting and its value.

**Done when** the settings record round-trips with a validated `historyLimit`, defaults to 10 when absent/malformed, and ticket 30 has a single source for `N`. Fixtures cite `browser-client.md` "Persistence" / "Bounded history".

## Answer

Landed in `src/client/browser-env.ts`, then the sole namer of both `thither.stacks.v1` and `thither.settings.v1` (ticket 30 moved the record formats, these functions included, into `src/client/persistence.ts`). Three exports, all free functions over the injected `StorageArea` (so they test against the same `Map`-backed fake as the host operations, in plain Node):

- `interface Settings { readonly historyLimit: number }` 
- `isHistoryLimit(value: unknown): value is number` 
  the predicate: `typeof number`, `Number.isInteger`, `>= 0`. `0` is legal. Exported so the S5 modal validates typed input with the same rule the reader uses, per the standards' "predicate at the edge, total transform elsewhere" split.
- `readSettings(storage): Settings` 
  absent key, unparseable JSON, non-object, missing field, or a `historyLimit` failing `isHistoryLimit` all read as `{ historyLimit: 10 }`. Reading **never repairs** the record (a malformed record is left byte-identical, matching `.load`'s stance on `thither.stacks.v1`). A throwing storage propagates, like `.load`.
- `writeSettings(storage, settings): void` 
  writes `JSON.stringify(settings)`; trusts the `Settings` type, so callers validate through `isHistoryLimit` before constructing one.

**Shape decision.** Free functions rather than fields on `BrowserEnv`: the two callers are `.save` (ticket 30, inside `createBrowserEnv`'s closure, already holding `storage`) and the S5 settings modal (`main.ts` holds `localStorage`). Neither needs the env to reach settings, and keeping the env to "operation set + output register" avoids growing the one-value env with non-run state. If ticket 32's `history()/restore()/reset()` land as free functions over `(interp, storage)` too, the persistence module stays uniform; revisit if they end up hanging off the env.

Not done here, by design: no `.save` reads `N` yet (ticket 30), no eviction on lowering the limit (falls out of ticket 30's trim-to-`N + 1`-on-every-write), no modal.

11 new fixtures (303 tests total), `pnpm verify` green. Branch `ticket/29-settings-and-history-limit`; `--no-ff` merge to `main` pending a human.
