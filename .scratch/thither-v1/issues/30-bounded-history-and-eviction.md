# Bounded history and eviction inside `.save`

Type: task
Status: claimed
Blocked by: 29

## Question

Deepen `.save` from the skeleton's single-element record into the bounded-history record of `browser-client.md` "Persistence" / "Bounded history", **without touching `.save`'s callers**.

In scope:

- `thither.stacks.v1` becomes an array of stacks whose **last element is the current stack** and whose earlier elements are previous stacks (history). With history limit `N`, the array holds at most `N + 1` stacks; an empty array is not a valid record; absence of the key is "no stored data".
- **Structural-difference rule** (`browser-client.md` "Bounded history"): push the previous current stack into history only when the new current stack differs from it by structural JSON equality. Ordinary searches add no entry; a mutation (or a `[A, B] → [A, B']` execution) does. The structural comparison is now **internal to `.save`** (history dedup/eviction only); it is no longer recorded in the register — [ticket 34](34-navigate-on-nonempty-query.md) removed `changed` from `OutputRegister` when navigation stopped depending on it.
- **Eviction** removes from the **front**, trimming to `N + 1` on every write, so lowering `N` (ticket 29) evicts the oldest excess on the next save. Always preserve the current stack.
- First initialization: current stack is `[emptyState()]`; it becomes a historical entry only after the first stack-changing execution. Snapshots are the whole returned stack after its terminal `R`/`E` is popped, never mutated later.
- Keep the existing skeleton guarantees: never persist an empty stack; a sealed `E` leaves the stored record untouched.

Out of scope: quota-exceeded retry (ticket 31) and the `history()/restore()/reset()` readers (ticket 32).

**Done when** `.save` maintains the bounded-history record with structural-difference dedup and front eviction to `N + 1`, its callers are unchanged, and fixtures cite `browser-client.md` "Bounded history" (dedup on search, entry on mutation, `[A,B]→[A,B']` adds, eviction order, `N = 0`).

## Answer

`.save` now maintains the bounded-history record; `.load`, `.out`, and every caller are untouched (the client still composes `.load <tokens> .$ .out .save`).

**Shape — and a refactor made in review:** the record formats moved out of `browser-env.ts` into a new root file **`src/client/persistence.ts`** (the name ticket 16's module map used before ticket 18 folded it in). It is now the sole namer of `thither.stacks.v1` and `thither.settings.v1`, holds `StorageArea` and ticket 29's settings functions, and exposes the stacks record as:

- `type StackHistory = readonly (readonly unknown[])[]` — the oldest-first array of stacks, current last, values unvalidated (`.load` validates through the interpreter).
- `readHistory(storage): StackHistory | null` — **an absent key reads as `[[emptyState()]]`** (first initialization, so the first mutation is undoable), an unreadable record as `null`; never repairs. Serving both operations from one reader removed the `raw === null` branch from *each* of `.load` and `.save`: `.load` is now "validate `readHistory(storage)?.at(-1)`", and the skeleton's `currentStackOf` is gone.
- `writeCurrentStack(storage, stack)` — `readHistory(storage) ?? []` (an unreadable record has no previous current stack to retain — the "Fallback UI and settings" reset case), then the private `appendHistory(previous, current, N)`: if `JSON.stringify(previous.at(-1)) === JSON.stringify(current)` the current slot is replaced (ordinary searches add nothing), otherwise `current` is appended and the previous current becomes history; then `slice` to the last `N + 1`, `N` from `readSettings(storage).historyLimit`.

`browser-env.ts` keeps `OutputRegister`, `BrowserEnv`, and `createBrowserEnv`; `.save` is "if non-empty, `writeCurrentStack`". Ticket 31's quota loop lands inside `writeCurrentStack`; ticket 32's `history()` is a `readHistory` projection, while `restore()`/`reset()` (which run programs) stay with the env.

**Two decisions to note:**

1. **The write re-reads the record rather than carrying it from `.load`.** The Web Lock encloses the whole `execute`, so the re-read sees what `.load` saw; and ticket 32's reset/restore programs (`<values> .$ .out .save`) have no `.load` at all, so the record must be discoverable from `.save` alone. This keeps the three host operations independent of each other's closure state, and `writeCurrentStack` callable with no `.load` at all.
2. **Structural equality is on the JSON as `.load` canonicalized it.** `.load` re-parses stored values through `pushToken`, so a hand-edited record whose key order or dimension case differs from canonical will register as "changed" exactly once (the canonical form enters history over the hand-written one). Accepted: it is a one-time normalization, not drift, and there is no persisted metadata to confuse.

Trimming happens on every write, so lowering `N` evicts on the next save even when that save is a plain search (fixture). `N = 0` writes `[current]` only.

Tests stay through the interpreter: nine fixtures under `describe('bounded history')` in `browser-env.test.ts`, each naming its `browser-client.md` section: first-init `[emptyState()]` enters history on the first mutation; search adds no entry; oldest-first ordering; `[A, B] → [A, B']` adds an entry (hand-written two-state record); `N = 1` evicts to two; `N = 0`; lowering `N` evicts on the next (search) save; unreadable record + reset-shaped program writes `[[B]]`; snapshots unchanged by later executions. 312 tests, `pnpm verify` green. Branch `ticket/30-bounded-history-and-eviction`; `--no-ff` merge pending a human. Unblocks 31 and 32.
