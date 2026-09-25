# Auto-navigate on a non-empty query, not on an unchanged stack

Supersedes the `changed` guard of [ADR 0007](0007-hosts-compose-the-program.md): `.save` no longer records whether the persisted stack changed, and navigation no longer consults it.

The browser client auto-navigates from an initial, URL-driven run when the terminal `R` holds exactly one match with a nonnegative argument balance. It used to add a third gate: the persisted stack must not have changed during the run, so that any mutation showed the fallback page instead of teleporting. Dogfooding the live shortcut broke that rule on its first outing: `https://example.com/ a b .set a b` — set the target, then search for it — showed the list rather than redirecting, because `.set` had flipped `changed`. The program plainly says "set this, then go there"; the guard was overriding what the user typed. We decided that the discriminator is **whether the user typed a query**, realised as the `R.inputs` the trailing `.$` consumed.

## The decision

Navigate iff the run is armed and initial, the terminal is an `R`, `R.matches` has exactly one entry, that match's `argDelta` is `≥ 0`, **and `R.inputs` is non-empty**. Nothing else is consulted: not the input token count, not the stored record, not whether a mutation ran.

`R.inputs` is the right witness because it is exactly the search the run performed, and it already separates every case we care about:

| Program | `inputs` | Outcome |
| --- | --- | --- |
| `a b` | `['a','b']` | navigates (unchanged) |
| `<u> a b .set a b` | `['a','b']` | **navigates** — the reported defect |
| `<u> home .set` | `[]` | shows the list; a set with no search still confirms |
| blank open | `[]` | shows the page — subsumes the old "empty input never navigates" guard |
| `home .@`, or a blank open under stored focus | `[]` | shows the page; focus is not part of `inputs` |

## Considered options

- **Keep the `changed` guard.** Rejected: it encodes "a mutation is never followed by navigation", which is a stance about what the user *meant*, contradicted by a program that literally ends in a search. Set-to-confirm survives anyway (`<u> home .set` has no query), so the guard bought nothing the query rule does not.
- **Gate on the raw input token count.** Already in place as a second guard; it cannot tell `home .@` (no search) from `home` (a search), so a focus-only program would navigate to whatever a single stored target was.
- **A `.set`-specific exception** ("navigate after `.set` if tokens follow it"). Rejected: it would need the client to parse the program, which [ADR 0007](0007-hosts-compose-the-program.md) forbids — the client reads only the register.

## Consequences

- The register's `saved` field goes away entirely: with `changed` gone it had no reader. The register is `terminal` and `loaded`. A `.save` that fails writes its `E(unknown_error)` into `terminal`, replacing the captured `R`, so the client renders the failure through the same path as any other `E`. Bounded history reintroduces structural difference as an internal dedup rule of `.save`, invisible to the client.
- A URL that both mutates and searches (`<u> a b .set a b` arriving as a pasted link) now redirects. This is the intended power-user behaviour and consistent with `browser-client.md`'s "execute the supplied program as-is; history provides recovery, not authorization".
- A failed `.save` cannot auto-navigate without a special case: its `E` is the terminal, and the rule only navigates on an `R`.
- `browser-client.md` "Execution flow" step 4 and its `.save` bullet, `CONTEXT.md`'s **Output register**, and ADR 0007's `.save` bullet are amended to match.
