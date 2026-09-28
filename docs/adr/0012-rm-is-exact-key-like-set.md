# `.rm` is exact-key like `.set`; arity disambiguates variants

Amends [ADR 0008](0008-arity-keyed-variants-and-exact-key-set.md)'s `.rm` and Focus bullets.

Under ADR 0008 `.rm` matched its targets the way `.$` does: the explicit dimensions, prefixed with focus, run as an fzf query, and every matched target removed. Because fzf fuzzy-matches a term against the whole key, a one-letter shortcut authorizes removal of every target whose key merely contains that letter — `g .rm` wipes `git`, `github`, `login`, `page`. For a search that is forgiving and reversible; for a delete it is a footgun, and the more targets a user has the wider it fires. ADR 0008 itself kept fuzzy `.rm` on the reasoning that "removal by search is the feature." Hand-testing shows the opposite: removal by search is the hazard.

## The decision

- **Exact key, like `.set`.** `.rm` no longer searches. It normalizes its explicit dimensions into a key (dsl.md §3) and looks for a target with **exactly that key**: string equality, no fuzzy matching, no prefix. A key with no target is a successful no-op. `jira` and `company jira` are different targets, so `company jira .rm` never touches `jira`.
- **Focus is ignored.** `.rm` does not consult focus. Focus is now a search prefix for `.$` alone. `.@`'s ability to carry operators (ADR 0008) is unaffected, because it exists for `.$`.
- **Operators are refused.** An explicit dimension carrying fzf operator syntax is `invalid_dimension`, exactly as `.set` treats it: what `.rm` names is a key, and a key is plain text.
- **Arity disambiguates a multi-variant target.** Without a separator, a **single-variant** target is removed whole. A target with **more than one variant** is `missing_operand`: the user must name which page by arity with the `. x x x` separator, whose suffix length is the arity to remove (unchanged from ADR 0008). This keeps a bare `.rm` from deleting every variant of a target at once.

## Considered options

- **Keep fuzzy `.rm`, add a confirmation gate.** Rejected: the client deliberately runs mutations without confirmation (browser-client.md), and a gate on every `.rm` punishes the safe common case to guard the rare wide one. Exact-key removes the hazard at the source instead of papering over it.
- **Exact key, but bare `.rm` removes a multi-variant target whole.** Simpler, but silently deleting several pages from one bare word is the same class of surprise we are removing, only narrower. Requiring the arity keeps "one bare `.rm`, one page."
- **A new `ambiguous` error type for the multi-variant case.** Rejected: the closed error vocabulary (dsl.md §6) already has `missing_operand` — "an operation lacks a required operand" — and the missing operand here is the arity selector. Adding a type is a spec change with no payoff.

## Consequences

- The fzf-operator matrix (`operators.test.ts`) moves `.rm` from the "operators apply" group to the "refused where a key is stored" group beside `.set`.
- `.rm` and `.set` now share their whole lookup story; dsl.md §4.2 is rewritten to lean on §4.1.
- `dsl.md` §2/§3/§4.2/§6, the operations table, `help.ts`'s `.rm` row, and ADR 0008's `.rm`/Focus bullets are amended to match. `.$`, `.@`, and `.set` are untouched.
