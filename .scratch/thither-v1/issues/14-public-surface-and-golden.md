# Assemble the public surface and golden §7 programs

Type: task
Status: open
Blocked by: 12, 13

## Question

Expose the core's public interface and prove it against the worked programs of `dsl.md` §7 as end-to-end golden tests.

**Surface.** `defaultEnv()` — preloads the four operations `.set`/`.rm`/`.@`/`.$` and the seed initial stack (one state value with no targets and empty focus) — and `createInterpreter(env)`, both exported from `src/dsl/index.ts`, the repo's sole barrel (adding an export there is a specification change per `code-standards.md`). Nothing internal leaks.

**Reconcile the interface with the docs.** The rewrite currently exposes `pushToken` (mutating) and lacks `emptyProgram`/`initialStack`, while [ADR 0005](../../../docs/adr/0005-extensible-interpreter-environment.md) and `browser-client.md` name `append` / `emptyProgram` / `initialStack`. Settle the final names and shape, and make code and docs agree **in the same commit** — the client tickets (16+) build against whatever this ticket lands. The program is internal and may be mutable (that doc claim was already dropped); this is about the entry points a client actually calls.

**Golden tests (§7).** All five worked programs produce exactly the stacks and JSON shown: create-and-implicitly-search; navigate-with-inferred-arguments; preserve-ambiguity-when-arguments-missing; select-every-target-with-empty-query; stop-at-first-result. Plus a totality property: no sequence of arbitrary strings makes appending or executing throw.

**Done when** the five golden programs match `dsl.md` §7 exactly, the public interface is reconciled with the docs (code amended, or docs amended to match, in one commit), and the core is importable by the client with no client-specific concern inside it.
