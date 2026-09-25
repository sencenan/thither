# Live execution from the text field

Type: task
Status: resolved
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

## Answer

Live execution landed as a new root module, `src/client/fallback-page.ts`, on `ticket/37-live-execution`; 402 tests, `pnpm verify` green; the built page boots in headless Chrome with the field mounted and the register rendered.

**The Web Lock is gone** — the one deviation from the ticket body and from `browser-client.md`, ruled by the human in review: cross-tab serialization is complexity out of proportion to a lost update between two tabs executing in the same microsecond. With it gone, a run is **synchronous end to end** (`execute` and `localStorage` both are), so the ticket's interleaving question answers itself: two runs in one page can never overlap, and the register the view reads is by construction the run that just finished. `browser-client.md` amended ("Execution flow" step 3 and the serialization paragraph now say runs are not serialized across tabs and why; Web Locks removed from the Baseline 2024 floor), ADR 0007's consequence bullet noted, the `.save` comment in `browser-env.ts` reworded, and ticket 40's "does an action run under the lock" question struck.

**Module map.** The re-run path earned its own module because it has state (the debounce timer, the field) and needs happy-dom tests, while `main.ts` stays the untested composition root:

- `src/lib/debounce.ts` — `debounce(fn, ms): { schedule(), flush() }`, trailing-edge; `flush` runs a pending call now and cancels the timer, and is a no-op with nothing pending. Fake-timer table in `src/lib/tests/`.
- `src/client/input.ts` — `tokenize(text)` exported (was private), so the field splits exactly as `readInput` does.
- `src/client/run.ts` — `run(interp, tokens): void` composes `.load <tokens> .$ .out .save` and executes it. Shared by the page-load run in `main.ts`, every live run, and now `navigation.test.ts`'s end-to-end fixtures (their hand-rolled copy is gone).
- `src/client/fallback-page.ts` — `mountFallbackPage(root, interp, env): FallbackPage`. Builds `<div class="field"><input></div><div class="results"></div>` inside `#app` (the `.field` wrapper leaves room for ticket 39's focus chip and ticket 40's gear), seeds the field from `env.input`, renders the register as it stands (no re-execution), focuses the field with the caret at the end, and wires `input` → 60 ms debounce → `run(interp, tokenize(field.value))` → `renderView(results, env)`. A `keydown` listener on the document refocuses the field on a printable key (`key.length === 1`, no Ctrl/Meta/Alt) unless the key was typed in another editable element — focus moving during keydown means the browser inserts the character into the field itself. Returns `{ flush() }`: ticket 38's "run now" for Enter, which runs a pending debounce and otherwise executes nothing, so Enter after a settled `<u> home .set` does not repeat the mutation. **Ticket 40 needs an unconditional `run()` beside it** for the after-action re-run; noted on that ticket.
- `src/client/view.ts` — `renderView(container, register)` unchanged but now targets the results region, so the field survives every render; new `renderBareError(root, error)` is the one bare-error rendering, used by `main.ts` for a page-load throw and by the page when a live run throws (localStorage gone mid-session): the page is replaced, as at load.
- `src/client/main.ts` — `run(interp, env.input)`, then `resolveNavigationDestination(env)` → `location.replace`, or strip the URL and `mountFallbackPage`. Still the only path through the navigation rule; `async` so a synchronous throw from `run` is the same rejection the one `.catch` renders.
- `src/client/style.css`, linked from `index.html` — the Launcher's centred 680 px column and field styling only; the single-file plugin inlines it as `<style>` and the dist verifier confirmed `dist/` still holds one file. Rows, badges, setup, and dialog styling belong to 38/39/40.

**Live runs never navigate** is structural — `fallback-page.ts` imports nothing from `navigation.ts` — and pinned by a fixture: a live single complete match with a query is rendered as a link with `location.href` unchanged and the field still focused.

**Fixtures** (`fallback-page.test.ts`, happy-dom, fake timers): seeded/focused/caret-at-end; mount renders without executing (write count); re-run at 60 ms not 59, mutation persisted and rendered; a burst of edits runs once; live `E` replaces the list beneath the same field; printable-key refocus, with a table of ignored keys (Escape, arrows, Ctrl/Meta/Alt chords) and typing in another editable left alone; `flush` runs a pending debounce once and is a no-op when settled; a throwing live run renders the bare error.
