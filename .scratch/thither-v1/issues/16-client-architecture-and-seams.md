# Design the client architecture and its seams

Type: grilling
Status: open
Blocked by: 15

## Question

Design the browser client's module boundaries before any client code is written, sized so that S2 implements a thin version of each seam and S4/S5 deepen them without redrawing the architecture.

Seams to draw, from `browser-client.md`'s execution flow:

- **Input reading**: query-versus-fragment `q` selection, `URLSearchParams` decoding, whitespace tokenization.
- **Storage**: reading the current stack, writing the remaining stack, and later the versioned records, bounded history, locking, and quota handling. What does its interface look like such that S2's naive single-record implementation and S4's full implementation are the same interface?
- **Execution**: composing `tokens.reduce(parse, parse(emptyProgram, lastStackValue))`, popping the terminal `R` or `E`, ordering the save before navigation.
- **Presentation**: rendering a result list, an error, and later the settings modal and setup instructions.
- **Navigation**: the direct-navigation decision (exactly one selected target, nonnegative argument balance) and the once-shown-never-auto-navigate latch.

Decide explicitly:

- Where the initial-URL-driven-execution versus live-execution distinction lives, given navigation is disabled for the rest of the page load once the UI is shown.
- How the DOM-dependent parts are kept testable in Vitest, given `browser-client.md` says persistence and UI only run in a browser — jsdom, an injected port, or a deliberate untested shell.
- What state the client holds in memory between live executions, and what it must re-read after acquiring the lock.
- How the client avoids acquiring any knowledge of language types, per ADR-0003: it must never inspect the copied value, extract `S`, or repair anything.

Handed here by earlier tickets:

- From [ticket 14](14-public-surface-and-golden.md): `execute` does not re-validate the persisted stack, so detecting a corrupted record is a client design decision.
- From [ticket 15](15-s1-checkpoint.md): a mutation program (`.set`/`.rm`/`.@`) gets the implicit `.$` appended, and when exactly one complete target remains the direct-navigation rule fires — `home https://example.com/ .set` on an empty state would set *and navigate*. Recommended: never auto-navigate when the persisted stack changed (the client already computes that difference for bounded history). Decide where that check lives in the Navigation seam.

Consult `codebase-design`. Record which S4 and S5 fog patches this design makes ticketable.

**Done when** the module map with each seam's interface is recorded on this ticket, and the human has confirmed it at the design level.
