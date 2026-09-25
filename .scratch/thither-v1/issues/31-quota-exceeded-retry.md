# Quota-exceeded retry inside `.save`

Type: task
Status: open
Blocked by: 30

## Question

Handle a storage quota overflow during `.save`, per `browser-client.md` "Persistence" step ("When a save exceeds the storage quota…") and `.save`'s contract in "Host operations".

In scope:

- When writing `thither.stacks.v1` throws a quota error, **drop the oldest history entries and retry**, always preserving the current stack. Repeat until the write succeeds or only the current stack remains.
- If saving still fails after eviction, `.save` pushes `E(unknown_error)` and writes that `E` into the register as `terminal`, replacing the `R` that `.out` captured, so the client surfaces the failure rather than treating the execution as persisted. The register has no `saved` field ([ticket 34](34-navigate-on-nonempty-query.md) removed it); the terminal is the only channel.
- Because the failure replaces the terminal, `resolveNavigationDestination` (`src/client/navigation.ts`, [ADR 0009](../../../docs/adr/0009-auto-navigate-on-a-non-empty-query.md)) refuses to navigate with no extra gate — it only navigates on an `R`. Pin that with a `session` fixture: a quota-failing storage renders the `E` and does not navigate.
- This deepens ticket 30's write path only; callers unchanged.

**Done when** a quota-throwing storage fake drives `.save` to evict-and-retry down to the current stack, a persisted write after eviction is observed, and a still-failing write yields `E(unknown_error)` on both the stack and the register's `terminal`. Fixtures cite `browser-client.md` "Persistence".
