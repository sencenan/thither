# Validate and normalize supplied structured values

Type: task
Status: open
Blocked by: 04, 06

## Question

Implement and test the structured-value half of `parse` per `dsl.md` §2 "Supplied structured values" and §3's normalization rules.

Rules in scope:

- Accept `S`, `R`, and `E` envelopes as top-level values; standalone `t`, `T`, `m`, `M` parse to `E`.
- Reject malformed required structures (`invalid_value`); preserve unknown object fields as uninterpreted data that never acquires execution semantics.
- Normalize a supplied `S`'s target dimensions and focus: `trim()`, locale-independent `toLowerCase()`, deduplicate, sort by default string order (UTF-16 code units). Reject dimensions with internal whitespace after trimming — that is invalid, not a request to split one dimension into several.
- Normalization must not change target order, destination text, argument spelling, or `R.inputs`.
- Within one target set, every normalized dimension set must be unique; duplicates make the value invalid, whether or not the destinations differ (`["Git", " company ", "git"]` normalizing onto an existing `["git", "company"]`). Do not merge or pick. Different `S` values in one program may each contain the same dimension sets.
- Validate every destination inside a supplied `S` via ticket 06.
- Validation happens at parse time, not when the item is reached: an invalid value placed after a terminal result still parses to `E`.

This is also the entry point the client reuses to validate manually supplied reset JSON, so its failure mode must be a returned `E`, never a throw, and a value that parses to `E` must not be allowed to replace persisted data.

**Done when** fixtures cover each rejection reason, the normalization examples from §2 and §3, unknown-field preservation, and order preservation.
