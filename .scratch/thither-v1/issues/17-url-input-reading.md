# Read program input from the URL

Type: task
Status: open
Blocked by: 16

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
