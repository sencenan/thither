# The settings actions on the history: revert, clear, import

Type: task
Status: resolved
Blocked by: 30

## Question

Provide the persistence entry points the S5 settings modal needs, per `browser-client.md` "Fallback UI and settings" and "Bounded history". Build and unit-test them now; the modal UI is S5.

**Re-charted twice.** The original ticket asked for `history()`, `restore()`, `reset()` as dry-run-guarded programs (`[...values, '.$', '.out', '.save']`). A first re-chart collapsed that to one `reset(env, values)`. Both were built and rejected in review, and the ticket was re-framed from what the user actually does on the settings page: they see the history of stacks and can (1) **revert** to one, dropping everything newer; (2) **clear** the whole thing and start from scratch; (3) **import** a stack pasted from another machine. There is no "current stack" concept apart from the last entry of the history.

In scope, all free functions in `src/client/persistence.ts` (ticket 29's rule: free functions over `StorageArea`, not env fields):

- `revertHistory(storage, index)`: truncate the record to `index + 1`. No re-validation — the values were validated when saved. Unreadable record or out-of-range index: no-op.
- `clearHistory(storage)`: remove `thither.stacks.v1`. Absence is first initialization. Settings kept.
- `importStack(interp, storage, values)`: push every value through `interp.pushToken`, `execute` the program, and write whatever stack results via `writeCurrentStack` (difference rule, eviction). **No validation and no refusal** — we are creating a new stack, so an invalid value lands as the `E` it parses to, the next `.load` reports it, and the user reverts or clears. Takes an `Interpreter`, not an env.

Out of scope: the modal UI, live/debounced execution, history-limit editing chrome, how the modal obtains `storage`/`interp`, and whether these actions run under the Web Lock (`main.ts` owns `runWithLock`) — all S5.

**Done when** the three functions exist with fixtures citing `browser-client.md` "Fallback UI and settings" / "Bounded history" (revert truncates; revert at the end or out of range is a no-op; clear removes the record and the next run seeds `[emptyState()]` with settings intact; import appends the pushed stack; import does not validate; import obeys the difference rule and the limit), and `browser-client.md` / ADR 0007 describe the three actions instead of reset/restore programs.

## Answer

Landed on `ticket/32-reset` as three exported free functions in `src/client/persistence.ts`; `browser-env.ts` is untouched apart from a stale comment, `BrowserEnv` unchanged.

```ts
revertHistory(storage: StorageArea, index: number): void
clearHistory(storage: StorageArea): void
importStack(interp: Interpreter, storage: StorageArea, values: readonly unknown[]): void
```

- **`revertHistory`**: `readHistory`, guard (`null`, `index < 0`, `index >= length`), `setItem(history.slice(0, index + 1))`. The selected entry is the last — current — one. Not itself undoable: the dropped entries are gone (spec now says so).
- **`clearHistory`**: `removeItem(STACKS_KEY)`. Absence *is* first initialization, so the next `.load` seeds `[emptyState()]` (fixture runs the client after clearing and gets `[[emptyState()]]`). `thither.settings.v1` is kept.
- **`importStack`**: `values.reduce(pushToken)` → `interp.execute(program)` → `writeCurrentStack(storage, stack)`. Pushing is the stack-machine sense: `S` values land as themselves, an unparseable value as its `parse_error` `E` (which seals the stack, so anything after it is absorbed). The write is `writeCurrentStack` directly, so the difference rule and eviction apply like any other write (fixtures: importing the current stack again adds nothing; `N = 1` evicts). No `.save` op, no env, no register; the `interp` is only for `pushToken`/`execute`.

**Why the two earlier designs were dropped (both built, both reviewed):**

1. *Reset/restore as programs with a `.$ .out` dry run.* Reset restores a stack; it does not run a search. And `.$` is not a pure terminal-maker — it consumes a literal array on top of the stack, so a restored snapshot ending in an `L` would have been altered. The dry run also existed only to stop a sealing `E` from being popped by `.out` and the valid prefix persisted — a problem the program shape itself created.
2. *A validating `reset(env, values)` writing through `.save`.* Validation was ceremony: an import creates a new stack, so whatever it parses to is what the user asked for, and the existing `.load` path already surfaces a bad value on the next run. "Restore" as re-validation-and-append also mis-modelled the user's intent, which is *go back to that point*, not *append a copy of an old stack*.

**Docs:** `browser-client.md` — the settings modal now "lists the stack history and offers three actions on it: revert, clear, import"; the reset-editor paragraph replaced by a paragraph on the three actions (not programs; revert drops newer entries and is not undoable; clear removes the record; import pushes and writes unvalidated); "Bounded history" dedup applies to "executions and imports"; "no current stack apart from the last entry"; recovery hint text points at the modal; Core-interface sentence reworded ("parses an imported stack's values"). ADR 0007's reset/restore bullet rewritten to say the actions are not programs and why the program design was dropped. `view.ts`'s `RESET_HINT` string left for S5 to reword with the modal.

**Tests:** six fixtures under `describe('settings actions on the history')` in `browser-env.test.ts`, each naming its section. 326 → 332 tests, `pnpm verify` green. **Unblocks 33: the S4 checkpoint is now the frontier.**

Handed to S5: how the modal obtains `storage` and `interp` (both exist in `main.ts`), whether the actions run under the Web Lock, what the page shows after an action (probably a fresh run), and rewording `RESET_HINT`.
