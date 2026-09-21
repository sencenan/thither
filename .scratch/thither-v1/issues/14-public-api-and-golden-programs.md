# Assemble the public API and golden programs

Type: task
Status: open
Blocked by: 12, 13

## Question

Expose the core interface from `browser-client.md` — `defaultEnv()` and `createInterpreter(env)`, whose interpreter carries `emptyProgram`, `append(program, item)`, `execute(program)`, and `initialStack` — and prove it against the worked programs of `dsl.md` §7 as end-to-end golden tests. (The surface was redesigned in ticket 04's answer; see [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md).)

Scope:

- The public entry module, with nothing internal leaking. `defaultEnv()` preloads the four operations and `interp.initialStack` — the stack a client persists before its first execution: one state value with no targets and empty focus.
- The program is an immutable ordered list: `append` returns a new program and never mutates its input.
- Golden tests for all five worked programs: create and implicitly search; navigate with inferred arguments; preserve ambiguity when arguments are missing; select every target with an empty query; stop at the first result.
- The client-composition shape from ADR-0003 exercised at least once: `tokens.reduce(interp.append, interp.append(interp.emptyProgram, lastStackValue))`.
- A totality property: no sequence of arbitrary strings causes `append` or `execute` to throw.

**Done when** the five golden programs produce exactly the stacks and JSON shown in `dsl.md` §7, and the core is importable by the client with no client-specific concern inside it.
