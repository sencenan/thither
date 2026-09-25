# Settings modal: history, revert, clear, import, history limit

Type: task
Status: open
Blocked by: 36, 37

## Question

Build the Settings control and modal per `browser-client.md` "Fallback UI and settings" and "Bounded history", on ticket 36's Launcher shape and ticket 37's re-run path, using ticket 32's actions and ticket 29's settings functions as they stand (free functions over `StorageArea`; the modal gets `localStorage` and the interpreter from `main.ts`).

- **Control and container.** A gear button at the field's right edge opens a centred `<dialog>` (`showModal`); Escape and a Close button close it. **Two columns side by side, 2:3, in a dialog of fixed minimum height (~900 × 520 px)** (ticket 36): **left** a compact history list that takes all the height the column leaves and scrolls only when it must, then **one line pinned at the bottom** holding the history-limit field + Save and the reset (clear) button, hints as tooltips; **right** the **stack panel** — a textarea filling the column's height that shows a selected entry's JSON and accepts a pasted stack, with Import on one row beneath it. The panel is the only place a stack's content is shown.
- **History list** from `readHistory(storage)` — every entry, **newest first, the current one at the top** and marked. A row shows **its target count only** (plus an `E` marker when the stack is sealed); **clicking a row loads that stack's JSON into the stack panel**, so the panel doubles as viewer, copy-out, and restore-as-new. The list scrolls within itself when long. When the record is unreadable, say so in place of the list and offer clear and import only.
- **Revert** (a button on every non-current row) → `revertHistory(storage, index)`; **clear** → `clearHistory(storage)`; **import** → `importStack(interp, storage, values)` from the stack panel's JSON stack array (parse failure of the text itself is a modal-level message, not a stack value; a non-array likewise).
- **History limit** field validated with `isHistoryLimit`, written with `writeSettings`; show the current value from `readSettings`; an invalid value is a modal-level message.
- **After any action the dialog closes, the page re-runs the field's current contents through ticket 37's path, and a short toast names what happened** (ticket 36, decision 7). No action replays a program, searches, or navigates. (There is no Web Lock to run under: ticket 37 dropped cross-tab serialization; a run is synchronous and so is each action.) The re-run is a call on ticket 37's `FallbackPage`: its `flush()` runs only a *pending* debounce (Enter's need), so add an unconditional `run()` beside it for the after-action re-run.
- **History depth is not on the register**; the modal reads `readHistory(storage)` itself (ticket 36, decision 2).
- Reword `RESET_HINT` in `view.ts` now that the control exists ("Recover in Settings").
- No settings URL or `view=settings` parameter.

TDD under `happy-dom`: the actions are already fixture-covered in `persistence.ts`; test the modal's wiring (which function is called with what, ordering of the list, click-to-view, what re-renders after an action) and the limit validation UX.

**Done when** the human can open Settings on the dev server, see the history newest first, view an entry's JSON, revert, clear, import, and change the limit, with the page reflecting each; `pnpm verify` green.
