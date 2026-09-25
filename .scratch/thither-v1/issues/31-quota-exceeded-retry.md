# Quota-exceeded retry inside `.save`

Type: task
Status: resolved
Blocked by: 30

## Question

Handle a storage quota overflow during `.save`, per `browser-client.md` "Persistence" step ("When a save exceeds the storage quota…") and `.save`'s contract in "Host operations".

In scope:

- When writing `thither.stacks.v1` throws a quota error, **drop the oldest history entries and retry**, always preserving the current stack. Repeat until the write succeeds or only the current stack remains.
- If saving still fails after eviction, `.save` pushes `E(unknown_error)` and writes that `E` into the register as `terminal`, replacing the `R` that `.out` captured, so the client surfaces the failure rather than treating the execution as persisted. The register has no `saved` field ([ticket 34](34-navigate-on-nonempty-query.md) removed it); the terminal is the only channel.
- Because the failure replaces the terminal, `resolveNavigationDestination` (`src/client/navigation.ts`, [ADR 0009](../../../docs/adr/0009-auto-navigate-on-a-non-empty-query.md)) refuses to navigate with no extra gate — it only navigates on an `R`. Pin that with a `session` fixture: a quota-failing storage renders the `E` and does not navigate.
- This deepens ticket 30's write path only; callers unchanged.

**Done when** a quota-throwing storage fake drives `.save` to evict-and-retry down to the current stack, a persisted write after eviction is observed, and a still-failing write yields `E(unknown_error)` on both the stack and the register's `terminal`. Fixtures cite `browser-client.md` "Persistence".

## Answer

**The ticket's evict-and-retry loop was built, reviewed, and rejected by the human** as heavy-handed for an event this unlikely: at these record sizes (a handful of small JSON stacks) the quota is effectively unreachable, and if it ever is, the user can lower the history limit or reset through the settings. **A save over quota now simply fails**, explicitly. `browser-client.md`'s "Persistence" quota paragraph and `.save` bullet, and ADR 0007's `.save` bullet, were amended in the same commit; the `dsl.md` §6 vocabulary is unchanged (`unknown_error`).

**`writeCurrentStack(storage, stack): void`** (`src/client/persistence.ts`): composes the next record as before (re-read, structural-difference dedup, trim to `N + 1`), then wraps the one `setItem` in a try/catch. On a throw it **pushes `['E', { type: 'unknown_error', description: 'the stack could not be saved: storage is full' }]` onto the stack it was given** and returns; the stored record is left as it was. A `boolean` success return was proposed in review and rejected — the operation-style contract (mutate the stack, fail through a pushed `E`) is the one every other operation in the core uses, so the client's write follows it too.

**`.save`** (`src/client/browser-env.ts`): after the write, peeks the stack top exactly as `.out` does; an `E` there becomes `env.terminal`, over the `R` that `.out` captured. Nothing else changed — `.load`, `.out`, and every caller are untouched.

**Decisions to note:**

1. **The thrown error is not inspected.** Browsers have disagreed on the quota error's name and code, and the only other way `setItem` fails is storage being unavailable — which `readHistory`'s `getItem` has already thrown on *outside* the try, so `main.ts`'s single catch still sees it.
2. **Navigation needs no new gate.** `resolveNavigationDestination` only navigates on an `R`; the `E` in `terminal` is enough. Pinned end to end in `navigation.test.ts`: a one-target record, query `home` (a single complete match), quota `0` → terminal is `E(unknown_error)`, destination `undefined`. Confirmed to fail against the pre-change `.save`.

**Tests:** the Map-backed fake in both client test files gained a `quota` (longest accepted value; over it, `setItem` throws a `DOMException('QuotaExceededError')`), and `browser-env.test.ts`'s `fakeStorage` second parameter became an options object (`{ throwOnRead, quota }`). Two fixtures citing `browser-client.md` "Persistence": quota `0` → `E(unknown_error)` is both the stack top and `terminal`, and the record equals its pre-run value; and the end-to-end no-navigation case above. 324 → 326 tests, `pnpm verify` green. Unblocks 33 jointly with 32.
