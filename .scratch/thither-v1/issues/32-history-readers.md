# History readers: `history()`, `restore()`, `reset()`

Type: task
Status: open
Blocked by: 30

## Question

Provide the history-inspection and reset/restore entry points the S5 settings modal will call, per `browser-client.md` "Fallback UI and settings" and "Bounded history". Build and unit-test them now; the modal UI is S5.

In scope:

- **`history()`**: read the record and return the previous stacks as a plain list (current stack excluded), no labels, timestamps, or origin metadata.
- **`reset()` and `restore()` are programs**, not bespoke writers: run `[...values, '.$', '.out', '.save']` through the interpreter so every value passes `pushToken` and an invalid value yields `E`. **Dry-run `[...values, '.$', '.out']` first** and refuse to save when the register's terminal is an `E`, leaving the stored record untouched. `.$` exists only so the epilogue has a terminal to capture; neither replays a program nor navigates.
  - **`reset(values)`**: `values` is a JSON stack array supplied directly (e.g. `[["S", {"targets": {}, "focus": []}]]`, no wrapper). A successful reset makes the supplied stack current and pushes the previous current stack into history under the ticket-30 difference rule; it does not clear history. When the stored record is unreadable there is no previous current stack to retain, so it simply writes the new record.
  - **`restore(index)`**: the same program over a chosen historical stack; makes it current and pushes the prior current stack into history under the same rule (so restoration is itself reversible while that entry survives eviction).

Out of scope: the modal UI, live/debounced execution, and history-limit editing chrome (all S5).

**Done when** `history()` lists previous stacks, `reset()`/`restore()` run as dry-run-guarded programs that refuse to persist an `E`, both retain the prior current stack under the difference rule, and fixtures cite `browser-client.md` "Fallback UI and settings" / "Bounded history".
