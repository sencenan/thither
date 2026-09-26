# Highlights and keyboard shortcuts

Type: task
Status: resolved
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

## Answer

Landed on `ticket/38-highlights-and-shortcuts`; `pnpm verify` green, **490 tests** (424 → +66). Verified on the built single file in headless Chrome: real fzf positions render `[c]ompany [g]it` (one term across the dimension boundary) and `di[git]al ocean` (a run inside a word), the applied argument is marked in the destination, unfilled `{}` are dashed placeholders, an incomplete row is dimmed with a dashed badge and warning-coloured balance, and the footer carries the count and key hints. The `Ctrl+digit` hand-drive with the field focused and unfocused is the human's on the dev server; both are pinned under happy-dom, which follows `a.click()` by moving `location.href`.

### The row

Every match is an `<li class="match [incomplete]">` wrapping **one `<a href=destination>`** that holds: a `<kbd>` badge (`1`–`9`, `0`, then empty), the key with its matched characters in `<mark>`, the destination as the template walked slot by slot (`<mark class="argument">` for a filled `{}`, `<span class="placeholder">` for an unfilled one — the destination string is only the `href`), the argument balance (`exact` / `+n extra` / `needs n more`), and `score n`. Rows keep `R.matches` order. After the list, a `<footer>` states `N match(es)`, `· shortcuts on the first ten` past ten rows, and the key hints.

### Two pure functions, DOM-free, table-tested in Node — `src/client/match-spans.ts`

- `keySpans(key, positions)` → `readonly ['text' | 'matched', string][]`: `hint.positions` (string indices into the key, dsl.md §5) coalesced into runs, empty pieces dropped. Pinned: `cg` → `[0, 8]` on `company git`, `git` → `[2, 3, 4]` on `digital ocean`, no positions, a run at the end, every character.
- `templateSpans(template, args)` → `readonly ['text' | 'argument' | 'placeholder', string][]`: the left-to-right slot walk. Pinned: every row of dsl.md §5's rendering table re-joins to the table's destination (the independent source ticket 42's `fillSlots` contract promised), the `{}`-as-argument row, an argument whose text also occurs in the template (`https://example.com/thither/{}` + `thither` — only the slot is marked), a slot at position 0.

Sigil-first tuples per code-standards; two narrow return types rather than one widened span union.

### Shortcuts and Enter — `fallback-page.ts`'s one `keydown` listener grew two branches

- **`Ctrl` + `Digit\d` / `Numpad\d`** (by `event.code`; Meta/Alt chords excluded) → `preventDefault`, then the named row's link is clicked. Works with the field focused or not (the listener is on the document).
- **Enter**, in the field or outside any editable → `preventDefault`, ticket 37's `flush()` (so it acts on the typed text), then **row 1 is clicked iff `env.terminal` is an `R` with `inputs.length > 0`** — ADR 0009's test. Pinned end to end: `t07 ↵` opens `t07` with one write (the flush ran once); `<u> home .set ↵` commits, lists, and stays; a blank open's Enter opens nothing though every target is listed; no matches → nothing; Enter in another editable is left alone (not `preventDefault`ed).
- **A shortcut, Enter, or a click opens any row, unfilled `{}` included** — pinned (`company` → `https://github.com/company/{}`).

**Decision: rows are ordinary anchors, and a shortcut or Enter is `anchor.click()`.** The ticket body said "same `location.replace` the click uses", but `browser-client.md` (normative) says *links in the fallback UI are ordinary anchors* — `replace` is justified only for *automatic* navigation, where the redirect must not stay in history. Anchors keep middle-click / ⌘-click / copy-link for free and give a user-chosen link ordinary history; the shortcut then literally performs the click, so click, `Ctrl+digit`, and Enter are one path. No spec change.

**`field.isConnected` guard.** The document listener outlives the page once `renderBareError` has replaced it (and, in tests, across mounts sharing one document); a detached field now releases the keyboard. Pinned: after a live run throws, `Ctrl+1` opens nothing.

### Reorganized in review: one module per region of the page

`view.ts` had grown to five concerns, and code-standards says a name changes in the commit its responsibility does, so the split rode along:

| File | Holds |
|---|---|
| `output.ts` (was `view.ts`) | `renderOutput(region, register)` — E strip → setup instructions \| match list → reset hint; `renderBareError`. The region is the **output register** rendered, so `.results` → `.output` (glossary: "result" means an `R`, and the region shows `E`s too). |
| `match-list.ts` | `renderMatchList(doc, matches)`, **`rowLink(region, n)`**, **`shortcutLink(region, event)`** — the list owns both directions of the digit↔row mapping; `SHORTCUT_DIGITS` is private. |
| `setup-instructions.ts` | `showsSetupInstructions(register)`, `renderSetupInstructions(doc, pageUrl)`. |
| `match-spans.ts` (was `spans.ts`) | the two pure functions above. |
| `fallback-page.ts` | unchanged in role; its handler is now `shortcutLink(output, event)?.click()` / `rowLink(output, 0)?.click()` and knows nothing about digits. A `field.ts` split was considered and rejected as the same pure-test-seam `session.ts` was before ticket 34. |

Imports stay one-way (`fallback-page → output, match-list`; `output → match-list, setup-instructions`; `match-list → match-spans`; `main → output, fallback-page`), dependency-cruiser clean. Tests follow the modules through their root files: `match-list.test.ts` (rows + direct `rowLink`/`shortcutLink` tables), `setup-instructions.test.ts` (a `showsSetupInstructions` table and explicit page URLs including `file:`), `output.test.ts` (composition only), `match-spans.test.ts`.

### Asset

`.scratch/thither-v1/assets/38-manual-stacks.json` — a compact `thither.stacks.v1` value (two history entries, 14 targets: variants of two arities, an argument that also occurs in its template, a diacritic key, >10 rows for `Ctrl+0` and the empty badges) to paste into `localStorage.setItem` for hand-driving. Validated through the real `.load`; keys stored canonical so the first save adds no history entry. Note §4.4's prefix inference fuzzy-matches argument letters (`jira a b` eats `a`), so argument recipes use an explicit `.`.

### Handed to ticket 40

Enter is intercepted only in the field or outside editables (a dialog textarea keeps its Enter); `Ctrl+digit` is intercepted anywhere. The **"no shortcuts while the dialog is open" guard is 40's**, along with the unconditional `run()` beside `flush()` and the `RESET_HINT` rewording. **Unblocks 40 — the S5 frontier is ticket 40 alone.**
