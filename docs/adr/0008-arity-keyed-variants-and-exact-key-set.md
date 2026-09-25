# Targets carry one variant per arity; `.set` is exact-key and ignores focus

A target used to be one dimension set → one destination template. That made the plain page and the parameterized page of the same site two targets with two dimension sets (`jira` and `jirahome`), and it made `.set` a fuzzy search that could silently overwrite a longer target (`jira` matching `[company, jira]`) instead of creating the shorter one the user typed. We decided that a **target** is a **key** (its normalized dimensions space-joined) owning a list of **variants** — destination templates told apart by **arity**, the number of `{}` — and that `.set` addresses a target by exact key equality with no fuzzy matching and no focus.

## The decision

- **State shape.** `targets` becomes a map from key to `Template[]`. Within a target no two variants share an arity, and the list is kept sorted by arity ascending. A supplied `S` violating either is `parse_error`.
- **`.set`.** Key = the explicit dimensions, normalized and joined; focus is not consulted. No target with that key → insert; target exists and has a variant of the new template's arity → replace that variant; otherwise → add a variant. Nothing is ever fuzzy-matched, so `ambiguous_set` is removed from the closed error vocabulary.
- **`.rm`.** The matching portion is still an fzf query, still prefixed with focus. Without a separator it removes every matched target whole. With a separator, the **count of suffix tokens is the arity** to remove (`jira . x .rm` removes the arity-1 variant, `jira . .rm` the arity-0 one) from every matched target; a target whose last variant is removed is removed.
- **Focus.** Now only ever a search prefix (`.$`, `.rm`), so `.@` accepts search operators (`!personal .@` is legal) and the stored-focus operator check goes away. `.set` refuses operators as before because what it stores is plain text.
- **`.$`.** Boundary inference is unchanged. For each selected target: if a variant's arity equals the argument count (**best fit**), emit one match for it; otherwise emit one match per variant, each rendered as far as the arguments allow. `m` carries the target's **key** instead of its dimension list.
- **Ordering.** Targets by score descending (ties in matcher order); within a target by argument balance — `0`, then positive ascending, then negative by magnitude ascending. Rows of one target are contiguous.
- **Direct navigation.** Unchanged for the client: exactly one match in `R` with a nonnegative balance. It follows that a multi-variant target only navigates on an exact arity.

## Considered options

- **A second dimension set per page** (`jira` vs `jirahome`). Works today; tedious, and the two are one destination in the user's head.
- **Choose a best-effort variant when no arity is exact** (smallest arity above the argument count, else the largest below) and navigate to it. Rejected: once a target has several variants, a wrong argument count is genuinely ambiguous about which page was meant, and a fallback page listing every variant is safer than guessing. A single-variant target keeps today's forgiving behaviour because its one variant is its only row.
- **Keep fuzzy `.set` and add focus.** Rejected: fuzzy matching in a mutation only adds ways to hit the wrong target, and combining focus into the stored key has confused users consistently. `.rm` keeps both because removal by search is the feature, and focus narrows what it removes.

## Consequences

- Persisted state changes shape. The product is unshipped; existing records are reset by hand, and no migration is written.
- `.set` with focus `[company]` and dims `jira` stores key `jira`; a subsequent search under that focus (`company jira`) will not find it. Focus users type the full key.
- A `{ key: Template[] }` object's iteration order is what the matcher sees as target-set order; integer-like keys (a dim such as `2024`) iterate first. Accepted: tie order among equal scores is not something we promise.
- `dsl.md` §1 (`t`, `T`, `m`), §3 (focus operators, matching query), §4.1–4.4, §5 (rendering per variant, ordering), §6 (vocabulary), and §7 (goldens) all change; see the `.scratch/thither-v1/issues/27` and `28` tickets.
