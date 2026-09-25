# Prototype the fallback page

Type: prototype
Status: resolved
Blocked by: 33

## Question

What should the fallback page look like, and how should match evidence be presented? Build a throwaway HTML sketch (no interpreter wiring needed; hand-written sample `R`s are fine) covering everything `browser-client.md` "Fallback UI and settings" describes, so the human can react to concrete shapes before the S5 build tickets commit to markup:

- the text field at the top holding the current program input, and where an `E` is shown relative to it;
- the result list in `R.matches` order, with **highlights** rendered from `hint.positions` / `hint.score` — which dimensions matched, which arguments were inserted — and how a non-navigable row (`argDelta < 0`, unfilled `{}`) reads differently from a navigable one;
- the `1`–`9`, `0` shortcut labels beside the first ten rows;
- the empty-target-set setup instructions (both shortcut URL templates and one example `.set` program) in place of the list;
- the Settings control and the modal: the history listed oldest-first, revert / clear / import actions, history-limit field, and what the page shows after an action.

Plain HTML + CSS, no framework; the answer records the decisions (structure, what a highlight looks like, where the modal lives, how many rows before scroll) and links the sketch as an asset. Do not reuse the sketch's markup wholesale in the build tickets — they follow the decisions, not the file.

Skills: `prototype`; `domain-modeling` for any new vocabulary (glossary terms: match, hint, target, variant, key).

**Done when** the human has reacted to the sketch and the recorded decisions are enough for tickets 37–40 to build without re-asking layout questions.

## Answer

**Asset:** `src/client/prototype-fallback-page.html` — one throwaway route under Vite's root (`pnpm dev` → `/prototype-fallback-page.html`), three structurally different variants on `?variant=A|B|C` (←/→ or the floating bar), nine data scenarios on `?scenario=`. It imports the real core, so highlights come from real `hint.positions`; state is in memory only, and clicks/shortcuts show a toast instead of navigating. To be committed on the throwaway branch `prototype/36-fallback-page`, not `main` (the commit was guarded pending human review).

**Variant chosen: A, "Launcher."** B (a monospace REPL transcript with a full-screen keyboard-driven settings takeover) and C (one card per target with dimension-chip highlights, a sidebar of focus/targets/history, and a side drawer) were built and rejected.

### Structure (Launcher)

- One centred column, ~680 px, on a neutral page: the **text field** with the stored **focus as a chip at its left edge** and the **Settings gear at its right edge**; then the result list; then a footer with the match count and the shortcut hint.
- An **`E` is a strip directly beneath the field**, in place of the list: `type` as code, then `description`; when `loaded` is false it carries a "Recover in Settings" link. The field itself is not restyled.
- The **list shows every match** and the page scrolls; the footer carries the match count and the key hints, and notes that only the first ten rows have shortcuts. Rows past ten have an empty badge.
- Each **row**: a digit badge, the key with highlighted characters, the destination beneath in monospace with inserted arguments marked and unfilled `{}` as dashed placeholders, and at the right the argument balance (`exact` / `+1 extra` / `needs 1 more`) with `score` under it. **Score stays in the UI.**
- A **row missing arguments keeps its positional digit** but is dimmed throughout, its badge dashed, its balance in warning colour. It is still openable (below).
- **Setup instructions** (empty target set, `loaded` true) replace the list inside the same card: heading, both shortcut URL templates built from the page's own origin+path, the example `S <url> dims .set` program with a "Try it" that puts it in the field.
- **Settings is a `<dialog>`** centred over the page, **~900 × 520 px (a fixed minimum height, so the layout never jumps)**, in **two columns side by side (2:3)**: **left** the history list — compact 30 px rows, newest first, **taking all the height the column leaves and scrolling only when it must** — with **one compact line pinned beneath it: `Limit [10] Save … Clear everything`** (hints as tooltips, not paragraphs); **right** the **stack panel** — one textarea that **fills the column's full height**, shows a selected entry's JSON and accepts a pasted stack, with Import (and Copy when it holds text) on a single row under it. The panel is the only place a stack's content is ever shown.

### Decisions the build tickets follow

1. **Highlights render from the template.** `Match` gains the variant's template in **slot 2, before the key** (`[u_or_p, template, k, [args], hint]`); the view walks the template's `{}` left to right, filled slots show their argument, unfilled ones stay visible; the destination is only the `href`. Filed as [Carry the variant's template on the match](42-template-on-match.md), blocking 38. Key highlights are `hint.positions` as string indices into the key, coalesced into runs.
2. **`.out` records the state**, not `.load`: after popping the terminal it records the `S` left on top as `register.state` (absent when nothing is left — the corrupted-record case). `.load` sees the world *before* the user's tokens; `.out` sees it after a `.set`/`.@`, which is what the page must show. Answers ticket 39's open question; supplies focus and target count. **History depth is not on the register** — anything that wants it reads `readHistory(storage)` separately.
3. **Debounce is 60 ms**, not 200 (felt sluggish on the sketch).
4. **The field owns the keyboard**: focused on load, caret at the end; a printable key pressed while it is unfocused refocuses it and types there.
5. **Shortcuts are `Ctrl+1`–`Ctrl+9`, `Ctrl+0`**, active whether or not the field has focus (a plain digit would collide with typing, and the "blur first" step was rejected). Read `e.code` (`Digit1`…, also `Numpad`), not `e.key`. **Enter opens the first row iff the run searched a query (`R.inputs` non-empty, ADR 0009's test)**, flushing a pending debounce first so it acts on the typed text; after a bare `.set` it only commits and lists. Enter = Ctrl+1 unconditionally was considered and rejected for exactly that `home .set ↵` case. **A shortcut, Enter, or a click opens any row, unfilled `{}` included** — the user goes where the program says; only auto-navigation demands `argDelta ≥ 0`. ⚠ `Ctrl+digit` is a browser-reserved tab switch on Windows/Linux Chrome and Firefox (macOS reserves `Cmd+digit`, leaving `Ctrl` free); whether the page ever sees it there goes on the S6 cross-browser checklist, with a fallback modifier to pick if it does not.
6. **History lists newest first, current at the top**; each row shows only its target count (plus an `E` marker when the stack is sealed); **clicking a row loads that stack's JSON into the right-hand stack panel**, which thereby serves as viewer, copy-out, and restore-as-new (import it). Revert buttons on every non-current row; the history-limit field and the reset sit under the list in the left column; the stack panel is the whole right column.
7. **After any settings action the dialog closes, the page re-runs the field's current contents, and a short toast names what happened.** No action replays, searches, or navigates.

### Amended

`docs/browser-client.md` — `.out` bullet (records `state`); "Fallback UI and settings" rewritten for 60 ms, field focus, `E` placement, template-rendered highlights, `Ctrl+digit` shortcuts and openable incomplete rows, ten-row cap, `state`-driven setup instructions, newest-first history with click-to-view, close-and-re-run after an action; "Bounded history" newest-first sentence. `CONTEXT.md` **Output register** now names the state the run left behind. `dsl.md` and **Match** are ticket 42's.

### Rejected on the way

- Left-to-right `indexOf` to locate arguments in the destination (ambiguous without the template).
- `hint.template` as a hint field: a template is not matching evidence.
- Plain-digit shortcuts with an Escape-to-blur step; then `Shift+digit` as an override for incomplete rows (typed `#` into the focused field).
- Derived per-entry diffs (`+ docs api`) and raw JSON as history-row summaries.
