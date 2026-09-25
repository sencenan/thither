# Highlights and keyboard shortcuts

Type: task
Status: open
Blocked by: 36

## Question

Extend `src/client/view.ts` per `browser-client.md` "Fallback UI and settings" and ticket 36's presentation decisions:

- **Highlights.** For each match, indicate which dimensions matched and which arguments were inserted, rendered from `hint.positions` and `hint.score` only — never by re-running the matcher. Positions index into the matcher's query as `dsl.md` §5 defines; pin the mapping with fixtures including a boundary-spanning position set and a match with no positions (empty query).
- **Shortcuts.** Rows 1–10 carry labels `1`–`9`, `0`. A keypress navigates to that row's destination (same `location.replace` the click uses) iff focus is outside an editable field and the row is navigable (`argDelta >= 0`). Non-navigable rows show no active shortcut and ignore the key.
- Rows keep `R.matches` order; the client does not sort.

TDD: highlight-span computation as a pure function table-tested in Node; key handling and rendering under `happy-dom`. Fixture names cite the spec paragraph.

**Done when** the dev server shows highlighted matches and numeric shortcuts behave as specified; `pnpm verify` green.
