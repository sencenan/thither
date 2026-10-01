# Nontrivial programs run on Enter

Supersedes `browser-client.md`'s "do not add confirmation gates for `.set`, `.rm`, or `.@`, including when input arrives through a URL", and the consequence in [ADR 0009](0009-auto-navigate-on-a-non-empty-query.md) that a URL which both mutates and searches redirects.

The fallback page ran every program live, on a 60 ms debounce, mutations included. That left no clear moment at which a mutation had happened: the field was emptied by a rule about the program's last token, and `.alias`, which can leave literals behind for the search, broke that rule. Rebuilding which literals survived from the typed tokens would have copied the language's consumption rules into the client. We decided that a **nontrivial program** — one whose user tokens contain any operation other than a `.$` as the last token — never runs as it is typed. It runs when the user presses Enter, and a successful run puts back into the field the search it ended with, rebuilt from the result's `inputs` and `args`. A plain search still runs live.

## The decision

- **What is nontrivial is read from the user's tokens, before the client composes them.** A token is an operation when the interpreter's parser binds it (`interp.pushToken` gives an `o` token), so an escaped `..set` and a half-typed `.s` are not operations, and the `.load`, `.$`, `.out`, `.save` the client adds around the tokens never count. A user's trailing `.$` does what the closing `.$` would do, so it alone does not make a program nontrivial.
- **The gate is the same for every source.** A nontrivial program typed into the field, or arriving through a URL, does not run until Enter. At page load the client runs only `.load .out`, so the page shows the stored focus and reports an unreadable record, and shows the program in the field with a notice and the key hints `Enter` run and `Esc` clear in place of the list. With no rows, the arrows and row shortcuts do nothing.
- **A successful run rebuilds the field from the `R`.** The field becomes `R.inputs`, then `.` and `R.args` when there are any ([dsl.md](../dsl.md) §4.4, which adds `args` to `R` for this). That is exactly what the search consumed, so the field and the list agree, and the text is a plain search that runs live again. A run that ends in an `E` keeps the program as typed, beside its error.
- **No automatic navigation after Enter.** Once the page is shown navigation is the user's, so a confirmed program is listed, never teleported.

## Considered options

- **Keep live execution and clear the field by the program's last token.** Rejected: the last token says nothing about literals `.alias` leaves for the search, and the field was emptied while a search was still in effect.
- **Track which literals each operation consumed from the typed tokens.** Rejected: it duplicates the language's consumption rules in the client, and every new operation would have to be taught to it.
- **Gate only typed input, still running nontrivial URL input at once.** Rejected: a link someone else sends could then change the user's targets without a keystroke, and two paths would need two rules.
- **Preview a nontrivial program by running it without saving.** Rejected: it still executes before the user asked, and a half-typed program would flash errors on every keystroke.

## Consequences

- An external link can no longer change state on its own; Enter is the confirmation, and history still provides recovery.
- The client inspects its user tokens, which [ADR 0007](0007-hosts-compose-the-program.md) and ADR 0009 kept it from doing. It only asks the core's parser whether each is an operation; what an operation does is still read from the register alone.
- `R` gains `args`; a supplied `R` without it has none.
- The `.set`/`.rm`/`.@` field-emptying rule is gone; its cases are the rebuild with empty `inputs`.
- A settings action re-runs the field only when it is a plain search; a waiting program is left unrun and only the stored world is reloaded.
