# Assemble the public API and golden programs

Type: task
Status: open
Blocked by: 12, 13

## Question

Expose exactly the four-symbol core interface from `browser-client.md` — `emptyProgram`, `parse(program, item)`, `execute(program)`, `initialStack()` — and prove it against the worked programs of `dsl.md` §7 as end-to-end golden tests.

Scope:

- The public entry module, with nothing internal leaking. `initialStack()` returns the stack a client persists before its first execution: one state value with no targets and empty focus.
- The program is an immutable ordered list: `parse` returns a new program and never mutates its input.
- Golden tests for all five worked programs: create and implicitly search; navigate with inferred arguments; preserve ambiguity when arguments are missing; select every target with an empty query; stop at the first result.
- The client-composition shape from ADR-0003 exercised at least once: `tokens.reduce(parse, parse(emptyProgram, lastStackValue))`.
- A totality property: no sequence of arbitrary strings causes `parse` or `execute` to throw.

**Done when** the five golden programs produce exactly the stacks and JSON shown in `dsl.md` §7, and the core is importable by the client with no client-specific concern inside it.
