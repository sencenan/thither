# Validate URLs and destination templates

Type: task
Status: open
Blocked by: 04

## Question

Implement and test destination validation per `dsl.md` §2 "URL and template validation".

Rules in scope:

- Render-then-parse: replace every `{}` with the probe token `thither`, validate the rendered string with the WHATWG `URL` parser, and accept when it parses and has an explicit scheme.
- Store and later substitute into the **original** template text, never the parser's normalized output of the probe.
- No scheme allowlist; a scheme does not require `//` (`mailto:user@example.com`, `myapp:open/{}` are valid). Never infer a scheme or resolve against a base URL.
- Placeholders allowed in any position, including the scheme: `{}://example.com` renders as `thither://example.com` and is accepted.
- Rejected: `https://exa mple.com/{}`, `example.com/{}`, `/path/{}`, `//example.com/{}`.
- Placeholder counting for `P` in `argDelta`, if this module owns it per ticket 04's seam map.

This validator is used in two places with different error paths — `.set`'s operand (an evaluation error, `invalid_destination`) and destinations inside a supplied `S` (a parse-time `E`) — so it must be callable without deciding which.

**Done when** the accepted and rejected examples in `dsl.md` are fixtures, plus placeholder-in-scheme and the round-trip guarantee that the stored text is byte-identical to the input.
