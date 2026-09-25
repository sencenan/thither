# Highlights and keyboard shortcuts

Type: task
Status: open
Blocked by: 36, 42

## Question

Extend `src/client/view.ts` per `browser-client.md` "Fallback UI and settings" and ticket 36's Launcher decisions:

- **Row shape.** Digit badge; the key with matched characters highlighted; the destination beneath in monospace with inserted arguments marked and unfilled `{}` shown as placeholders; at the right the argument balance (`exact` / `+n extra` / `needs n more`) and `hint.score`. A row with `argDelta < 0` keeps its positional digit but is dimmed, its badge dashed, its balance in warning colour.
- **Key highlights** from `hint.positions` only — string indices into the key, coalesced into runs — never by re-running the matcher. Pin a boundary-spanning position set (`cg` → `company git`), a run inside a word (`git` → `di[git]al ocean`), and a match with no positions (empty query).
- **Argument highlights** by walking the match's **template** (ticket 42, slot 2) left to right: filled `{}` show their argument, unfilled ones stay visible; the destination string is only the `href`. Pin that template + args rendered slot by slot equals the destination.
- **Shortcuts.** Rows 1–10 carry digits `1`–`9`, `0`; **`Ctrl+digit`** opens that row (same `location.replace` the click uses) **whether or not the field has focus** — read `e.code` (`Digit1`… and `Numpad1`…), not `e.key`. **Enter opens the first row iff `R.inputs` is non-empty** (ADR 0009's test — `<u> home .set ↵` commits and lists, `git thither ↵` goes), after flushing ticket 37's pending debounce so it acts on the typed text (coordinate the seam with 37: the key handler needs a "run now" entry point). Pin both cases. **A shortcut, Enter, or a click opens any row, unfilled `{}` included**; only auto-navigation demands `argDelta >= 0`. Rows past the tenth have no shortcut and an empty badge.
- **Every match is listed**; the page scrolls. The footer states the match count and the key hints, and notes that only the first ten rows have shortcuts.
- Rows keep `R.matches` order; the client does not sort.

TDD: highlight-span computation (key runs; template walk) as pure functions table-tested in Node; key handling and rendering under `happy-dom`. Fixture names cite the spec paragraph.

**Done when** the dev server shows highlighted matches and `Ctrl+digit` shortcuts behave as specified with the field focused and unfocused; `pnpm verify` green.
