# S1 checkpoint: the core is correct

Type: grilling
Status: open
Blocked by: 14

## Question

Human review of the complete language core before any client code exists. This is the most load-bearing checkpoint in the map: everything downstream assumes the core is right, and `browser-client.md` deliberately leaves the client with no validation of its own.

Walk the human through:

- the public API as built, against `browser-client.md`'s four symbols;
- the type model as it actually ended up, against ticket 04's design, naming any drift and why;
- the `fzf` configuration chosen, and what it means for ranking in practice;
- the conformance suite read against `dsl.md` section by section, naming any normative rule with no fixture behind it.

Then exercise the core live against realistic programs the human supplies — their own dimensions and destinations, not spec examples — and have them judge whether match ordering and prefix inference feel right in use. Disagreement here is a specification question, not a bug: surface it as a doc amendment or a new ADR rather than patching the code around it.

**Done when** the human signs off the core, or the corrections are ticketed and resolved first.
