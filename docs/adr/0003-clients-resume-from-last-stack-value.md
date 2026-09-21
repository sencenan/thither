# Clients resume by making the last stack value the program's first item

A client persists the whole data stack returned by an execution (after popping its terminal `R` or `E`), but the next execution is not a resumption of that stack: the client copies only the stack's **last** value, appends it to an empty program as the first item, then appends the user's input tokens. Evaluation always starts from an empty stack, and the language has no notion of a previous run. The alternatives were serializing state back into DSL source text (forcing the client to understand the language) or resuming the entire persisted stack (making every saved value semantically live).

## Consequences

- The client stays deliberately dumb: it never inspects value types, extracts `S`, or repairs anything; an unsupported first item simply produces an `E`.
- Values below the last one survive only as debugging history and possible future extension material; they do not affect the next execution.
- Parsing is total: an unparsable token becomes an `E` value in the program stream, so the client's pop/save/display loop is identical for success, evaluation errors, and parse failures, with no `try`/`catch` path.
