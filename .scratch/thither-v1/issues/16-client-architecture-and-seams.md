# Design the client architecture and its seams

Type: grilling
Status: resolved
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

## Answer

Grilled over five rounds. The first draft was a conventional client — a `StackStore` interface with the Web Lock inside `store.update(fn)`, an execution module, a view — and the human redrew it twice: first **persistence as host operations** on the ADR-0005 environment, then, when the interpreter's implicit `.$` turned out to have no room for an operation *after* the search, **the core appends nothing; hosts compose the program**. Recorded as [ADR 0007](../../../docs/adr/0007-hosts-compose-the-program.md), superseding ADR 0006. `dsl.md` §1 Lifecycle / §4.2 / §7, `browser-client.md` (Core interface, new "Host operations", Execution flow, Web Locks, malformed data, reset), ADR 0005's consequences, and `CONTEXT.md` (**Host**, **Host operation**, **Output register**) amended in this commit.

### The program

```text
.load  <user tokens…>  .$  .out  .save
```

Every run — initial, live, reset, restore — is this shape (reset/restore substitute supplied values for the tokens). The core's `execute` evaluates exactly this; the implicit `.$` is removed by the new [Remove the implicit terminal from the core](24-remove-implicit-terminal.md).

### Module map (`src/client`, root files are the seams)

| Module | Interface | S2 | S4/S5 |
| --- | --- | --- | --- |
| `input.ts` | `readInput(url: URL): string`, `tokenize(text): string[]`. Pure. | full | — |
| `persistence.ts` | `createPersistence({ storage, interp }) → { symbols, register }`. Three `OpFn`s — `.load`, `.out`, `.save` — and the **output register** `{ terminal?, loaded, saved? }` they write to. `storage` is the `getItem/setItem/removeItem` surface, injected. | one-element record, `changed` flag, malformed → `parse_error` | history + eviction + settings + quota retry inside `.save`; `history()/restore()/reset()` readers for the modal |
| `session.ts` | `createSession({ interp, register, locks, navigate, render }).run(input, mode)`. Builds the program, executes under `locks.request` (or bare), reads the register, calls pure `decideNavigation(register, armed)`. Holds the **`navigationArmed` latch**. | `initial` mode | `live` mode + 200 ms debounce caller |
| `view.ts` | `render(register): HTMLElement`. | plain links / error text | highlights, shortcuts, setup instructions, modal |
| `main.ts` | Composition root; the client's single `try`/`catch`. | | |

### Decisions

- **Storage and Execution seams collapse into the program.** No store interface: `.load`/`.save` are the adapters at ADR-0005's seam, and the spec's persistence rules (save before navigate, skip execution on malformed data, validate held data through `pushToken`) fall out of program order rather than client discipline.
- **`.out` pops only an `R` or `E`**, else no-op — it extracts output for the host, it is not a general pop. **`.save` persists the stack as-is, never empty.** Because `.out` unseals the stack, a save failure is an ordinary failed op: push `E(unknown_error)` and mirror it into the register.
- **The client reads only the register**; the returned stack is ignored. The register is where the `changed` flag (ticket 15's hand-off) lives: `.save` is the only thing that sees old and new, and `decideNavigation` refuses to auto-navigate when `saved.changed`. `home https://example.com/ .set` therefore sets and shows the list.
- **Corrupted record** (ticket 14's hand-off): `.load` shape-checks the record and validates the current stack's values via `interp.pushToken`; it pushes the resulting `parse_error` and sets `loaded: false`. The client adds the "recover via Settings reset" hint from that flag, not from the `E`'s `type`.
- **No `host_error`.** `dsl.md` §6 stays closed: recoverable failures reuse `parse_error`/`unknown_error`; `localStorage` unavailable **throws**, caught once in `main.ts`.
- **Initial vs live**: one `run(input, mode)`; the latch flips false on first render; only `initial` mode with the latch armed may navigate. In-memory state is the latch and the register — no cached stack; every run re-reads inside `.load`.
- **Web Lock** wraps the single synchronous `interp.execute` call; nothing inside the client coordinates.
- **Auto-navigation uses `location.replace`** (no back-button redirect loop); fallback rows are plain anchors.
- **Testing**: `input`, `persistence`, `session` in plain Node — persistence through the interpreter against a `Map`-backed storage fake. `view.ts` under **happy-dom** via a per-file `@vitest-environment` pragma, added when S2's view lands. `main.ts` untested by design.
- **Host ops are user-typeable** (`home .out foo`); the epilogue runs last so a stray one cannot corrupt the final write. Documented, not defended.
- Names: `.load`, `.out`, `.save` (over `.lls`/`.sls`: role, not mechanism).

### Fog this makes ticketable (graduated by the S2 checkpoint, not now)

- **S4**: bounded history + difference rule + eviction + `thither.settings.v1` inside `.save`; quota retry inside `.save`; Web Lock in `session.ts`; `history()/restore()/reset()` readers on `persistence.ts`. Reset/restore are programs (`[...values, '.$', '.out', '.save']`, dry-run without `.save` first).
- **S5**: `view.ts` prototype (layout, highlights from `hint.positions`); `live` mode + debounce; `1`–`9`/`0` shortcuts; setup instructions on empty target set; settings modal over the S4 readers.

### Tickets touched

- New: [Remove the implicit terminal from the core](24-remove-implicit-terminal.md) (core code + tests, unblocked) and [The REPL composes its own program](25-repl-epilogue.md) (blocked by 24). **Order is core → REPL → client**: both 17 and 18 are `Blocked by: 16, 25`, so no browser-client work starts until the core's new contract is proven and the one existing host has adopted it.
- Rewritten: [Register the host operations](18-naive-persistence.md) (was "Persist the stack, naively"), [Wire the skeleton](19-skeleton-execute-and-navigate.md). Both had gone stale on ADR-0003 vocabulary (`initialStack`, `emptyProgram`, `parse`).
- Reworded: [S2 checkpoint](20-s2-checkpoint.md) to check the register/host-op shape instead of a storage interface.
