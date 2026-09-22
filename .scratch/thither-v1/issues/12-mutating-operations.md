# Implement .set, .rm, and .@

Type: task
Status: open
Blocked by: 11

## Question

Implement the three state-changing operations per `dsl.md` §4.1–4.3, registered as operations in the core's environment, failing through the error/unwind primitives from ticket 11.

**The matcher is born here.** There is no standalone matcher ticket (the old ticket 10 was deleted — a matcher built without a caller just guesses its interface, the ticket-08 mistake). `.set`/`.rm` are the matcher's first real callers, so grow the selection helper *inside this ticket* with the signature these callers dictate: given a target set and a combined (explicit + focus) query, return **which targets match, by slot**. `.set`/`.rm` need selection and slot identity only — **no `score`, no `positions`** (those are demanded solely by `.$`, so they arrive in ticket 13, which generalizes this helper under its second caller). This ticket owns §3's **selection** rules: every query dimension must match (AND), query-dimension order is irrelevant (`git company` ≡ `company git`), an empty query selects all targets, matches come back in target-set order. Reuse the fzf config settled in [08-matcher-adapter](08-matcher-adapter.md)'s answer (`fuzzy:'v2'`, `casing:'case-insensitive'`, `normalize:false`, `match:basicMatch`, `sort:false`); do not import fzf's query operators.

**`.set`**: extract the **last** literal of `L` as the destination (never search backward for a URL), validate it (`invalid_destination` on failure), keep the matching portion of the remainder, require **at least one explicit dimension** there — focus cannot satisfy it — then match the combined (explicit + focus) query in full. Zero matches appends a new target with the normalized combined dimensions to the **end** of the target set; exactly one replaces only that target's destination, preserving its dimensions and position; more than one raises `ambiguous_set` with the input state left unchanged. Fuzzy updating never renames dimensions. Missing destination, missing explicit dimension, or missing state anywhere is `missing_operand`.

**`.rm`**: with no `L`, or an empty matching portion, leave state unchanged without matching, regardless of focus — focus alone never authorizes removal. Otherwise match the complete combined query and remove every match; zero matches is a successful no-op, multiple are allowed; never shorten the query (`company nonexistent` does not retry `company`).

**`.@`**: normalize the matching portion and **replace** focus with it, never combining with the old focus; no `L`, or an empty matching portion, clears focus (`S company . git .@` sets focus to `[company]`, not `[company, git]`).

All three ignore the separator's suffix and must preserve input state until they succeed, upholding §3 target-set order: supplied order kept, inserts appended, updates in place, removals without reordering — that order is the final ranking tiebreak.

**Done when** fixtures cover each `.set` cardinality row and its `missing_operand` / `invalid_destination` / `ambiguous_set` cases, the focus-never-authorizes-removal cases (`S .rm`, `S . ignored .rm`), the `.rm` no-retry case, `S company . git .@`, and target-set order across all three operations.
