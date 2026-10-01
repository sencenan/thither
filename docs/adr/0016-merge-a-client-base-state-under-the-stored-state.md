# Merge a client base state under the stored state

Amends the browser client's program in [ADR 0007](0007-hosts-compose-the-program.md) and the load-only run of [ADR 0015](0015-nontrivial-programs-run-on-enter.md).

The page should always be able to reach itself: a `thither` target opening this page, present without the user setting it. We decided that every run places a **client base state** beneath the stored world and merges the stored state into it with the core's `.merge` ([dsl.md](../dsl.md) §4.6). The program becomes `B .load .merge <tokens…> .$ .out .save`, and the load-only run becomes `B .load .merge .out`. `B` holds one target, keyed `thither`, whose single arity-0 variant is the page's own URL with its query and fragment dropped, built once from `location.href` by the composition root. The stored state is merged on top, so it wins every conflict and keeps its focus.

## Considered options

- **Seed the base state only when there is no stored record.** Rejected: existing users would never get the target, and a removed target would stay removed with no way back.
- **Add the base targets at search time without saving them.** Rejected: the client would have to patch the stack or the result outside the language, and the user could not override the target through the stored state.
- **A fixed release URL instead of the page's own.** Rejected: a `file:` copy, a dev server, or a fork would point at someone else's page.

## Consequences

- The merged state is what `.save` persists, so the base state becomes part of every user's stored record, and the first search after this ships writes a new history entry. Undoing the decision would leave a `thither` target in every record.
- The `thither` target can be overridden, since the stored copy wins the merge, but not removed: `thither .rm` takes effect for one run, and the next merges the target in again.
- The stored copy pins the URL the page was first loaded from. A later base state with a different URL loses to it.
- The setup instructions count only the user's targets: they show, headed "No custom targets yet", while every key of the state is a key of the base state, between the result list's summary bar and its rows, so the `thither` target stays reachable.
- When `.load` fails, its `E` seals the stack above `B`, so `.merge` never runs, nothing is saved, and the register's `state` is `B`.
- `.load` pushes the whole stored stack, so a stored stack with more than one value on top (only reachable by import) merges its own top two values, leaving `B` beneath them.
