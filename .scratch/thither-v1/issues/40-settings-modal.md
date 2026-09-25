# Settings modal: history, revert, clear, import, history limit

Type: task
Status: open
Blocked by: 36, 37

## Question

Build the Settings control and modal per `browser-client.md` "Fallback UI and settings" and "Bounded history", on ticket 36's shape and ticket 37's re-run path, using ticket 32's actions and ticket 29's settings functions as they stand (free functions over `StorageArea`; the modal gets `localStorage` and the interpreter from `main.ts`).

- **History list** from `readHistory(storage)` — every entry, oldest first, the last one marked current. Decide how a stack is summarised in a row (target count, focus, whether it is an `E`).
- **Revert** → `revertHistory(storage, index)`; **clear** → `clearHistory(storage)`; **import** → `importStack(interp, storage, values)` from a pasted JSON stack array (parse failure of the pasted text itself is a modal-level message, not a stack value).
- **History limit** field validated with `isHistoryLimit`, written with `writeSettings`; show the current value from `readSettings`.
- **Decide** (grilling pass first): does an action run under the Web Lock (`navigator.locks.request('thither', …)` like a run), and what does the page show afterwards — recommended: a fresh live run of the current field contents via ticket 37's path, so the list reflects the new current stack. No action replays a program, searches, or navigates.
- Reword `RESET_HINT` in `view.ts` now that the control exists.
- No settings URL or `view=settings` parameter.

TDD under `happy-dom`: the actions are already fixture-covered in `persistence.ts`; test the modal's wiring (which function is called with what, what re-renders) and the limit validation UX.

**Done when** the human can open Settings on the dev server, see the history, revert, clear, import, and change the limit, with the page reflecting each; `pnpm verify` green.
