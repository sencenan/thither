# Read program input from the URL

Type: task
Status: resolved
Blocked by: 16, 25

## Question

Implement and test input reading per `browser-client.md` "Reading input".

Rules in scope:

- Precedence: if the query contains `q`, use its value; otherwise read `q` from the fragment; otherwise the input is empty.
- **Presence, not truthiness**, decides: an explicitly empty `?q=` takes priority over fragment input. Other query parameters do not prevent fragment fallback. When both sources contain input, execute only the query input — never concatenate.
- Parse both the query and the fragment's parameter text with `URLSearchParams`, using its standard decoding exactly once: `+` is a space, `%2B` a literal plus. No extra `decodeURIComponent` pass.
- If the selected source holds multiple `q` parameters, use the first.
- Split the user's input on JavaScript whitespace (`\s`) and produce tokens in order. Input tokens are never treated as JSON.
- Program input stays in the URL after execution: no `history.replaceState` cleanup, no replay suppression.

**Done when** fixtures cover each precedence row including empty `?q=` beating a populated fragment, the decoding cases, multiple `q` parameters, and tokenization of multi-space and tab-separated input.

## Answer

Landed `src/client/input.ts` exporting `readInput(url: string): readonly string[]`, with 17 table-driven fixtures in `src/client/tests/input.test.ts` (234 tests total, `pnpm verify` green). Committed on branch `ticket/17-url-input-reading` (`b13a9e8`); merge to `main` pending — a human runs the `--no-ff` merge (git guardrail blocks the agent).

Key design points:

- **One pure function over the full URL string**, not the DOM. `readInput` takes `location.href` and parses it with the universal WHATWG `URL`, so it tests in the plain-Node vitest environment with no happy-dom. `main.ts` will pass `window.location.href`.
- **Presence, not truthiness, via `URLSearchParams.has('q')`.** Query `q` is checked first; an empty `?q=` still has the key, so it returns `[]` and never falls through to the fragment. Other query params don't shadow it and don't block fragment fallback.
- **Single decode.** Both sources go through `URLSearchParams` (`+`→space, `%2B`→literal `+`); `.get('q')` returns the first value already decoded, so no second `decodeURIComponent`. The fragment's leading `#` is stripped before parsing (`URLSearchParams` strips `?` but not `#`).
- **Tokenization** splits on `/\s+/` and drops empties, so multi-space, tab, and leading/trailing whitespace all collapse to ordered non-empty tokens; empty input yields `[]`.

Returns `readonly string[]` (spread into the `['.load', ...tokens, '.$', '.out', '.save']` program by a later ticket). No `history.replaceState` cleanup — replay policy is out of this ticket. No new module surface beyond `input.ts`.
