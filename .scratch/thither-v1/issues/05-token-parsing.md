# Parse string tokens into values

Type: task
Status: open
Blocked by: 04

## Question

Implement and test the string-token half of `parse(program, item)` per `dsl.md` §2.

Rules in scope:

- One item per call; the core never tokenizes a multi-item string.
- Operations `.set`, `.rm`, `.@`, `.$`.
- The standalone `.` separator, and only standalone: a dot inside `node.js` or `example.com` is ordinary content.
- Double-dot escaping: `..rm` → literal `.rm`, `..set`, `..$`, and `..` → literal `.`. Escaped tokens are not re-interpreted as operations.
- An unrecognized, unescaped dot-prefixed token parses to `E` (`parse_error`).
- Everything else is an ordinary literal retaining exact spelling.
- Parsing is total: never throw, never reject the whole program.

Note that `..$` must not satisfy the lifecycle's "last item is already the operation `.$`" test — that check belongs to the evaluator (ticket 09), but the value it inspects is produced here, so make the distinction representable.

Tests are table-driven fixtures citing `dsl.md` §2 subsections, per the map's test convention.

**Done when** every token form above has fixtures, including the negative cases, and `parse` is proven total over arbitrary strings.
