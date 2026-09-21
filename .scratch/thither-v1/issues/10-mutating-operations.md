# Implement .set, .rm, and .@

Type: task
Status: open
Blocked by: 06, 08, 09

## Question

Implement and test the three state-changing operations per `dsl.md` §4.1–4.3.

**`.set`**: extract the **last** literal as the destination (never search backward for a URL), keep the matching portion of the remainder, require at least one explicit dimension there — focus cannot satisfy it (`missing_dimensions`) — then match the combined query. Zero matches appends a new target with the normalized combined dimensions **to the end** of the target set; exactly one replaces only that target's destination, preserving its dimensions and its position; more than one raises `ambiguous_set` with the input state left completely unchanged. Fuzzy updating never renames dimensions: if `comp git` uniquely matches `[company, git]`, the stored dimensions stay `[company, git]`.

**`.rm`**: with no literal array, or an empty matching portion, leave state unchanged without matching, regardless of focus — focus alone never authorizes removal. Otherwise match the complete combined query and remove every match. Zero matches is a successful no-op; multiple matches are allowed; never shorten the query to obtain a match, so `company nonexistent` does not retry `company`.

**`.@`**: normalize the matching portion and **replace** focus with it, never combining with the old focus. No literal array, or an empty matching portion, clears focus.

All three ignore the separator's suffix, and all three must preserve their input state until they have succeeded.

Also uphold the target-set ordering guarantees of `dsl.md` §3: supplied order kept, inserts appended, updates in place, removals without reordering — that order is the final ranking tiebreak, so it is behaviour, not incidental.

**Done when** fixtures cover each `.set` cardinality row, the explicit error examples in §4.1, the focus-never-authorizes-removal cases (`S .rm`, `S . ignored .rm`), `S company . git .@` setting focus to `[company]` and not `[company, git]`, and target-set order across all three operations.
