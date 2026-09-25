# S3 checkpoint: dogfood the live shortcut

Type: grilling
Status: resolved
Blocked by: 22

## Question

Human review of Thither as a deployed tool, driven from their own browser's address bar — the first time the thing is used the way it is meant to be used.

Have the human configure the search shortcut from ticket 22's templates, in their real browser, and then live with it: set their actual targets, navigate to them by dimension, pass arguments, and try the fragment form as well as the query form. This is where `%s` substitution problems with `#`, `&`, and `+` will first appear; note what breaks, since S6's checklist is written from these observations.

Judge: does the shortcut contract hold up, is the single-file artifact behaving on Pages as ADR-0002 assumed, and is the fallback page tolerable enough to use daily while S4 and S5 are built? Anything intolerable becomes a ticket now rather than waiting for S5.

Note that the scheme-policy question is **closed** and deliberately not reopened here.

**Done when** the human is using the deployed Thither from their address bar, and any blocking defect found is ticketed.

## Answer

**Signed off.** The human ran the deployed Thither from their real browser's address bar — shortcut configured from ticket 22's templates, both query and fragment forms, real targets set and navigated to by dimension with arguments, and the `%s` stress cases exercised. Everything held up except one case, which is now ticketed as a deliberate rule change (not a deploy or single-file defect).

### Verdict against the checkpoint criteria

- **Shortcut contract holds** on `sencenan.github.io` for both `?q=%s` and `#q=%s`; the single-file artifact behaves on Pages exactly as ADR-0002 assumed (served bytes identical to the local build, no missing assets, persistence survives reloads on the real origin).
- **Fallback page is tolerable** for daily use through S4/S5; no rough edge was called intolerable (the S2-accepted ones — reset hint promising an S5 Settings control, no live input box yet — stand).
- **Scheme policy** left closed, as instructed.

### The one case → a rule change, ticketed

`<u> a b .set a b` from the address bar did **not** redirect. Root-caused (reproduced live, both readings): the current rule refuses to auto-navigate after any mutation, because `.set` flips `saved.changed` — the documented "never auto-navigate after a mutation" guard (`browser-client.md` step 4 + the `home .set` worked example; ticket-15 handoff). Working as specified, but the human ruled the spec **wrong**: the program explicitly says "set, then search `a b`", so it should redirect — *let the user do what the program says*.

**Decided (grilling):** replace the `changed` guard with a query-driven rule — auto-navigate iff exactly one match with `argDelta ≥ 0` **and a non-empty query** (`R.inputs.length > 0`). `changed` drops out of navigation. `R.inputs` is the right discriminator: it redirects the reported case and any real search, keeps `home .set` (no trailing query) showing the list, subsumes the blank-open guard, and leaves focus-only searches (empty `inputs`) non-navigating — all verified live against the core this session. Filed as [ticket 34](34-navigate-on-nonempty-query.md) (code + `browser-client.md` amendment + new ADR); [ticket 30](30-bounded-history-and-eviction.md) reworded so its structural-diff is history-internal, not a register field.

### S6 seed

The `%s` substitution of `#`, `&`, `+` behaved as expected across the forms tried; no new breakage beyond the documented query-form `+`→space / `#`-truncation, which S6's `docs/search-shortcut-checklist.md` should still enumerate per browser.
