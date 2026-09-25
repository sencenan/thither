# Live execution from the text field

Type: task
Status: open
Blocked by: 36

## Question

Implement the live-execution path of `browser-client.md` "Fallback UI and settings", following ticket 36's layout decisions.

- The text field is seeded from `env.input` (the URL is already stripped by ticket 35; the address bar is never re-read).
- The field takes focus when the page is shown (caret at the end), and a printable key pressed while it is unfocused refocuses it and types there (ticket 36 decision 4); `Ctrl+digit` and Enter are ticket 38's and must still reach their handler with the field focused; expose a "run now" entry point that flushes the pending debounce, since Enter opens the first row of what was typed, not of the previous run.
- Editing restarts a **60 ms debounce** (ticket 36 lowered it from 200; `browser-client.md` amended); when it fires, the client splits the field like `readInput` does, composes `.load <tokens> .$ .out .save`, executes it under the Web Lock, and re-renders from the register. Live execution is the ordinary flow — mutations and bounded history included — not a read-only search.
- **Live runs never navigate.** The page-load run in `main.ts` remains the only path through `resolveNavigationDestination`; once the UI is shown, navigation is by click or shortcut only. Ticket 34 removed the `navigationArmed` latch and collapsed `session.ts` into `main.ts`; decide whether the re-run path lives in `main.ts` or earns a module of its own (it now has state: the debounce timer and the field), and keep `main.ts` the untested composition root.
- Two runs must not interleave: a debounce firing while a run holds the lock queues behind it (the lock already serializes) — confirm the register the view reads is the latest run's.

TDD (`tdd` skill): the debounce and split/compose logic pure and table-tested; the re-render path under `happy-dom` like `view.test.ts`. Cite the spec paragraph in each fixture name.

**Done when** typing in the field on the dev server re-runs the program, mutations persist, results re-render, and no live run ever navigates; `pnpm verify` green.
