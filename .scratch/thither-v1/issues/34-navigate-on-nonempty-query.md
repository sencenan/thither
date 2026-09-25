# Auto-navigate on a non-empty query, drop the `changed` guard

Type: task
Status: open

## Question

Change the auto-navigation rule so it keys on **whether the user typed a query**, not on whether the stack changed. Surfaced at the S3 checkpoint ([ticket 23](23-s3-checkpoint.md)): `<u> a b .set a b` from the address bar did not redirect, because `.set` flips `saved.changed` and the current rule refuses to navigate after any mutation. The user's verdict: the program says "set this, then search `a b`", so it should redirect — *let the user do what the program says*.

**New rule:** auto-navigate iff the run is armed and initial, and the terminal `R` holds **exactly one match with `argDelta ≥ 0`** whose **query is non-empty** (`R.inputs.length > 0`). The `changed` flag drops out of navigation entirely.

Why `R.inputs` is the right discriminator (each verified live against the core this session):

- `<u> a b .set a b` → trailing `.$` consumed `a b` → `inputs: ['a','b']` → **navigates** (the reported defect, now fixed).
- plain search `a b` → `inputs: ['a','b']` → navigates (unchanged).
- `<u> home .set` (no trailing query) → trailing `.$` has no query, matches all targets → `inputs: []` → **shows the list**, so a set with no search still confirms rather than teleporting. Set-intent preserved without a `changed` flag.
- blank open (`?q=` empty / absent) → `inputs: []` → shows the page. This **subsumes** the current `input.length > 0` guard, whose sole job was to stop a one-target store redirecting on a blank open.
- focus-only / focus-driven search (`home .@ .$`, or a blank open resolving stored focus) → focus is **not** part of `inputs`, so `inputs: []` → does not navigate. This preserves today's behavior (focus-setting is a `.@` mutation that never auto-navigated) with no special case.

In scope:

- **`src/client/session.ts`** — rewrite `decideNavigation` to test `terminal[0] === 'R'`, `matches.length === 1`, `match[3].argDelta >= 0`, and `terminal[1].inputs.length > 0`. Drop the `saved`/`changed` checks. The `armed` computation in `run` keeps `mode === 'initial'` and `navigationArmed`; the `input.length > 0` term can go (subsumed by the `inputs` check) — decide during implementation whether to keep it as a cheap short-circuit or remove it; either way its behavior must be covered by a fixture.
- **`src/client/browser-env.ts`** — remove `changed` from `OutputRegister` and stop recording it in `.save`. At the skeleton stage `.save` computed the structural diff *only* for the register, so that computation can be dropped here; [ticket 30](30-bounded-history-and-eviction.md) reintroduces structural-difference detection for **history dedup/eviction** (an internal concern of `.save`, not a register field).
- **Tests** — update `session`/`view` fixtures. Pin: Scenario A redirects; plain search redirects; `home .set` shows the list; blank open shows the page; focus-only search shows the page; incomplete single match (`argDelta < 0`) still renders a clickable link but does not auto-navigate.
- **Docs** — amend `browser-client.md` step 4 and the paragraph after it (the `changed` guard and the `https://example.com/ home .set` worked example), and its `.save` bullet (drop "records `changed` … in the register"). Reword the ticket-15 "never auto-navigate after a mutation" note wherever it's echoed. Write a new **ADR** superseding the changed-guard decision: hard to reverse, surprising without context, a real trade-off (set-and-go vs set-to-confirm) — record that the discriminator is "the user typed a query," realised as `R.inputs`.

Out of scope: S4 history/eviction (tickets 29–33) beyond the `changed`-register removal noted above; any change to `.$`, `inputs`, or `argDelta` semantics (they already carry exactly what this rule needs).

**Done when** the new rule is implemented and tested, `changed` no longer appears in `OutputRegister` or the navigation path, `browser-client.md` and the new ADR describe the query-driven rule with `<u> a b .set a b` as the worked redirect example, and `pnpm verify` is green.
