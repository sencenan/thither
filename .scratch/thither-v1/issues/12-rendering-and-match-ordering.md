# Render destinations and order matches

Type: task
Status: open
Blocked by: 11

## Question

Implement and test argument application and match ordering per `dsl.md` §5.

**Rendering**: fill the original template's `{}` left-to-right with literal, case-preserved arguments — no percent-encoding, and replacement text is never re-parsed as template syntax. `hint.argDelta = A - P` counts **every** supplied argument, while `m`'s `[args]` field holds only the applied ones (`first min(A, P)`). Extras are ignored during substitution; missing placeholders stay intact, leaving a partially rendered template in the match's first slot.

**Ordering**: `R.matches` is emitted in one total order so the client renders top to bottom without sorting. Compare by, in turn:

1. nonnegative `argDelta` first;
2. `|argDelta|` ascending;
3. `hint.score` descending;
4. target-set order.

Note the consequence the spec calls out: closeness to a balanced argument count outranks match quality, so a weakly scored `+1` precedes a strongly scored `+2`.

Also make expressible — without deciding it here — the rule that ordering never manufactures uniqueness: a direct-navigation candidate needs exactly one selected target with nonnegative balance, and missing-argument matches still count toward ambiguity. The check itself is the client's.

**Done when** every row of the §5 rendering table is a fixture (including `a/b` producing a path segment and the zero-placeholder template ignoring its argument), each ordering key has a fixture isolating it including the weak-`+1`-beats-strong-`+2` case, and the order is proven total, leaving no pair undetermined.
