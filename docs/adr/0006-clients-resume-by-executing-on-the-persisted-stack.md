# Clients resume by executing the program on the persisted stack

Supersedes [ADR 0003](0003-clients-resume-from-last-stack-value.md).

`execute(program, stack?)` takes the data stack to evaluate on; when omitted, evaluation starts empty. A client resumes by passing its current persisted stack as that argument, and the program holds only the user's input tokens. The interpreter copies the supplied stack before evaluating, so the persisted snapshot is never mutated. On first run there is no persisted stack, so the client seeds one as `[emptyState()]` — the core's helper for the state value with no targets and empty focus — without knowing the shape of `S`.

ADR 0003 achieved resumption by copying the last persisted value into the program as its first item, so that evaluation always began from an empty stack. That routed the persisted state through `pushToken`'s validation for free, but it made the program carry a value that was never source input, required a separate `emptyProgram`/`initialStack` pair on the interpreter, and turned every stack value below the top into dead history that a new execution could not see. Passing the stack makes resumption explicit: the program is the input, the stack is the world it runs against.

## Consequences

- Every operation acts on the top of the stack and peeks rather than pops its state, so values beneath the top ride along unchanged; `[A, B]` becomes `[A, B']` rather than `[B']`. Earlier values remain debugging history in practice, but the language no longer forbids an operation from reaching them.
- The persisted stack is **not re-validated** by `execute`. A record that the client itself wrote round-trips intact, but a corrupted or hand-edited one lands on the working stack as-is. How the client detects an unreadable record is a client design decision (`browser-client.md`'s malformed-data error state); it is no longer a by-product of parsing.
- Manually supplied reset JSON is still validated value by value through `pushToken`, which remains the one total entry point for untrusted data.
- `emptyProgram` and `initialStack` are gone: the empty program is `[]`, and the seed stack is `[emptyState()]`.
