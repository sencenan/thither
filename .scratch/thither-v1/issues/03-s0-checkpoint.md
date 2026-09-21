# S0 checkpoint: the harness is trustworthy

Type: grilling
Status: open
Blocked by: 02

## Question

Human review of the scaffold before any Thither code is written. Does the toolchain match what the next twenty tickets assume?

Walk the human through: the installed dependency set and pinned versions, the source layout and why the core/client split falls where it does, the strictness settings actually in effect, the scripts, and the deploy workflow as authored. Demonstrate the proven-failing type error and the passing test.

Decide: anything to change before S1 starts, and anything discovered here that should amend `docs/code-standards.md`.

**Done when** the human confirms the harness, or the corrections are made and confirmed.
