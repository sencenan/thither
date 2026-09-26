# Destination validation probes with both a string and a number

Type: task
Status: resolved
Blocked by:

## Question

Surfaced hand-driving the S5 checkpoint (ticket 41): authoring `https://localhost:{}`
(a `{}` in the **port**) was wrongly rejected as an invalid URL.

`isTemplate` renders every `{}` to a single probe token before parsing with the WHATWG
`URL`. No single probe is valid in every position — a port must be all digits, a scheme
must start with a letter — so the current word probe `thither` (chosen by dsl.md §2 so a
`{}` *scheme* validates) rejects a `{}` *port*, and a numeric probe would reject a `{}`
*scheme*.

Decision (human, during the drive): **probe with both a string and a number; accept the
template if either rendering parses.** Keeps `{}` in every position, port and scheme alike,
and stays consistent with dsl.md §2's existing caveat that acceptance was never a promise
that every rendered result parses.

Blocks the S5 checkpoint (41): basic target authoring must work before sign-off.

## Answer

Implemented in `src/dsl/utils.ts`: `isTemplate` now renders the template with each of two
probes — the word `thither` and the digit `1` — and accepts the template when **either**
rendering parses under the WHATWG `URL`. A `{}` port (`https://localhost:{}`) validates via
the numeric probe; a `{}` scheme (`{}://example.com`) still validates via the word probe;
schemeless refs (`//example.com/{}`, `/path/{}`, `example.com/path`) parse under neither and
stay rejected. Store/substitute into the original template text as before.

`dsl.md` §2 amended (the "render, not parse" paragraph) to describe the two-probe rule and
add `https://localhost:{}` to the accepted examples. Parser tests gained the `{}`-port case
alongside the existing `{}`-scheme case. `pnpm verify` green.
