# Build the fuzzy matcher adapter

Type: task
Status: open
Blocked by: 04

## Question

Implement and test matching per `dsl.md` §3 and §5 "Matching evidence", on top of the npm `fzf` port.

Rules in scope:

- Join each target's canonically sorted dimensions with spaces into **one searchable string**.
- Build the query: take the operation's explicit matching literals, use lowercase copies for matching (originals retained elsewhere), prepend focus, deduplicate.
- Match each query dimension **independently** against the whole searchable string; select only when every dimension matches; sum the per-dimension scores. A fuzzy token may span dimension boundaries.
- Query-dimension order never affects selection or score: `git company` and `company git` behave identically.
- Case-insensitive; diacritic normalization **disabled** (`cafe` does not match `café`).
- No fzf query operators: do not route user input through `extendedMatch`; compose literal fuzzy patterns yourself. The [fzf research note](../../../docs/research/fzf-libraries.md) flags this as the integration trap.
- No confidence threshold or winner-margin rule — a first-ranked match is not automatically unique.
- `hint.positions`: ascending, deduplicated **union** of matched character indices across all query dimensions, as indices into the searchable string. A character matched by two dimensions appears once; the list does not record which dimension matched it.
- `hint.score`: the summed score; no breakdown required, though an extra debugging field is permitted.
- A query with no dimensions selects everything with empty `positions` and `score: 0`.

Configure `fzf` explicitly (`fuzzy`, `casing`, normalization, tie-breakers) rather than relying on its defaults, and pin the version. Test Thither's expected behaviour, not parity with upstream fzf.

**Done when** the configuration is explicit and justified on this ticket, and fixtures cover multi-dimension AND selection, boundary-spanning tokens, order independence, the diacritic case, and the empty-query case.
