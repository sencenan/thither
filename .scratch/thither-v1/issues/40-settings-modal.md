# Settings modal: history, revert, clear, import, history limit

Type: task
Status: resolved
Blocked by: 36, 37

## Question

Build the Settings control and modal per `browser-client.md` "Fallback UI and settings" and "Bounded history", on ticket 36's Launcher shape and ticket 37's re-run path, using ticket 32's actions and ticket 29's settings functions as they stand (free functions over `StorageArea`; the modal gets `localStorage` and the interpreter from `main.ts`).

- **Control and container.** A gear button at the field's right edge opens a centred `<dialog>` (`showModal`); Escape and a Close button close it. **Two columns side by side, 2:3, in a dialog of fixed minimum height (~900 × 520 px)** (ticket 36): **left** a compact history list that takes all the height the column leaves and scrolls only when it must, then **one line pinned at the bottom** holding the history-limit field + Save and the reset (clear) button, hints as tooltips; **right** the **stack panel** — a textarea filling the column's height that shows a selected entry's JSON and accepts a pasted stack, with Import on one row beneath it. The panel is the only place a stack's content is shown.
- **History list** from `readHistory(storage)` — every entry, **newest first, the current one at the top** and marked. A row shows **its target count only** (plus an `E` marker when the stack is sealed); **clicking a row loads that stack's JSON into the stack panel**, so the panel doubles as viewer, copy-out, and restore-as-new. The list scrolls within itself when long. When the record is unreadable, say so in place of the list and offer clear and import only.
- **Revert** (a button on every non-current row) → `revertHistory(storage, index)`; **clear** → `clearHistory(storage)`; **import** → `importStack(interp, storage, values)` from the stack panel's JSON stack array (parse failure of the text itself is a modal-level message, not a stack value; a non-array likewise).
- **History limit** field validated with `isHistoryLimit`, written with `writeSettings`; show the current value from `readSettings`; an invalid value is a modal-level message.
- **After any action the dialog closes and the page re-runs the field's current contents through ticket 37's path** (ticket 36, decision 7, **minus its toast**: the re-rendered list is the feedback, and the spec never asked for more). No action replays a program, searches, or navigates. (There is no Web Lock to run under: ticket 37 dropped cross-tab serialization; a run is synchronous and so is each action.) The fallback page owns the gear and mounts the dialog, so the re-run is the page's own unconditional run, called from the dialog's after-action callback; `FallbackPage.flush()` stays as it is (a pending debounce only, Enter's need) and no `run()` is added to its interface — that would be a pure test seam. `mountFallbackPage` gains `storage` as a fourth argument, which `main.ts` supplies as `localStorage`.
- **History depth is not on the register**; the modal reads `readHistory(storage)` itself (ticket 36, decision 2).
- Reword `RESET_HINT` in `output.ts` (ticket 38 renamed `view.ts`) now that the control exists ("Recover in Settings"); plain text, not a link that opens the dialog, so `renderOutput(region, register)` keeps its signature.
- **Keyboard while the dialog is open** (handed over by ticket 38): the page's one `keydown` listener intercepts `Ctrl+digit` anywhere and Enter in the field or outside any editable, following the row's link via `match-list.ts`'s `shortcutLink`/`rowLink`. Neither may open a row while the dialog is open; Enter in the dialog's textarea and limit field must stay theirs. Escape closes the dialog.
- No settings URL or `view=settings` parameter.

TDD under `happy-dom`: the actions are already fixture-covered in `persistence.ts`; test the modal's wiring (which function is called with what, ordering of the list, click-to-view, what re-renders after an action) and the limit validation UX.

**Done when** the human can open Settings on the dev server, see the history newest first, view an entry's JSON, revert, clear, import, and change the limit, with the page reflecting each; `pnpm verify` green.

## Answer

Landed on `ticket/40-settings-modal`: `pnpm verify` green, 490 → 518 tests, boundaries clean, single-file build unchanged in shape.

**Ticket revised before building (human's call): no toast after an action.** The re-rendered list is the feedback, and `browser-client.md` never asked for more — ticket 36's decision 7 stands minus its toast. With no reader for a summary, the dialog's callback is `onAction: () => void`.

### Shape

**New root file `src/client/settings.ts`** — `createSettingsDialog(doc, interp, storage, onAction): SettingsDialog { element: HTMLDialogElement; open(): void }`. It creates and returns the `<dialog>`; the page places it. `open()` re-reads `readHistory`/`readSettings`, clears the stack panel and the message, then `showModal()`.

- **History list**, newest first, the current entry on top and tagged `current`. Each row's summary is a button — `N targets`, plus ` · E` when the stored stack ends in an `E` (an import that failed to parse), or `no state` when no `S` is recognizable (values are unvalidated, so the summary walks down to the nearest `S` defensively) — that loads the entry's pretty-printed JSON into the stack panel. Revert on every non-current row → `revertHistory(storage, index)`.
- **Pinned controls** are one `<form novalidate>`: `Limit [n] Save … Clear everything`, hints as tooltips. Enter in the limit field submits = Save, so it never reaches the page's Enter handler. **Native constraint validation is deliberately off**: with `min=0 step=1` the browser (and happy-dom) swallowed the submit for `-1`/`2.5` with its own bubble while `ten`/`''` reached our handler — now every bad value gets `isHistoryLimit`'s one message. Save → `writeSettings`; Clear → `clearHistory` (settings kept, pinned by fixture).
- **Stack panel**: a textarea filling the right column, Import beneath. Not-JSON and non-array are modal-level `role="alert"` messages (dialog stays open, nothing written, text kept); a bad *value* is imported as the `E` it parses to, per the spec's "Import does not validate". Parsing returns a small `{ values } | { refusal }` rather than an `array | string` union.
- **Unreadable record**: a line in place of the list; Clear and Import remain, Revert is absent; the limit controls stay (they are not actions on the record).
- **Every action**: perform → `dialog.close()` → `onAction()`. Close only closes. Escape is the native `<dialog>` cancel; verified in real Chrome, not in happy-dom.

**`fallback-page.ts`** — `mountFallbackPage(root, interp, env, storage)`: the fourth argument is how the modal gets `localStorage` (ticket 29's "free functions over `StorageArea`, not env fields" kept; `main.ts` passes `localStorage`). The page owns the gear (`⚙`, `aria-label="Settings"`) at the field's right edge and builds the dialog with `onAction = runField` — the debounce body, now a named function — so after an action the page re-runs the field's current contents; the dialog's `close` event refocuses the field; the document `keydown` listener bails while `settings.element.open`, so no shortcut fires, Enter is left to the dialog's own controls, and a printable key does not pull focus back. **No `run()` was added to `FallbackPage`**: the page calls its own run, so exposing one would have been a pure test seam (the `field.ts` argument from ticket 38). `flush()` unchanged.

**`output.ts`** — `RESET_HINT` is now "Recover in Settings: revert to an earlier stack, clear, or import one." — plain text, so `renderOutput(region, register)` keeps its signature.

**`style.css`** — the dialog per ticket 36: `min(900px, 94vw) × min(520px, 85vh)`, two columns 2:3, the list taking the column's height and scrolling only when it must over one pinned control line, the textarea filling the other column, one message line spanning both; plus the gear.

### Tests

`settings.test.ts` (happy-dom, 21): list order and marking, `E`/`no state` summaries, click-to-view writes nothing, revert/clear/import/limit asserted on the fake storage's contents and on the dialog closing + `onAction` firing once, the three modal-level refusals leave storage untouched with the dialog open, Enter-in-limit-field saves via `requestSubmit`, unreadable record, Close, reopen re-reads. `fallback-page.test.ts` (+7): gear opens; revert/clear re-render the page from the new record (a clear re-runs against first initialization, which the run then persists as `[[emptyState()]]`); Ctrl+1 / Enter / printable keys inert while open; close refocuses the field. `output.test.ts` hint text updated.

### Verified live

Built `dist/index.html` driven in headless Chrome over CDP (throwaway script, not committed): a seeded 5-deep history listed newest first; click-to-view filled the panel; `-1` produced the message; **native Escape closed the dialog and refocused the field**; Revert to the 3-target entry closed the dialog and the `git` list re-rendered with three rows, the record at three entries. Layout matched the Launcher sketch. **Closed on fixtures plus this headless check, no human hand-drive** — ticket 41's drive script already covers the modal end to end, as ticket 33 did for S4.

### Notes for later

- `Array.prototype.findLast` is ES2023 and the repo `lib` is ES2022, so the nearest-`S` walk is a loop; bumping `lib` to match the Baseline-2024 floor is a standards decision, not taken here.
- **Unblocks 41 — the S5 checkpoint is the only frontier ticket.**
