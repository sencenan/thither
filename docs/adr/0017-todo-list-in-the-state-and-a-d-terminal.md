# A todo list in the state, ended by a `D` terminal

Thither only navigated to known destinations. Users also want to park pages they mean to read or act on later. We decided that the **state of the world** holds a **todo list**, an ordered list of **todo items**. A todo item is a bare URL: an explicit scheme, no `{}` placeholder, stored verbatim. Two new operations change and show it. `.todo` appends a URL, or with no literal array leaves the list as it is. `.done` removes a URL. Both end the run with a new terminal value, `D` (`["D", {"todo": [u]}]`), which carries the todo list as the operation left it. A client shows a todo view when its run ends in a `D`. Finishing an item deletes it.

## The decision

- **The todo list is a field of `S`.** It is `todo: [u]`, with no duplicates, and defaults to `[]` when a supplied `S` omits it. Because it lives in `S`, history, revert, import, and `.merge` cover it with no new mechanism. `.merge` concatenates the two lists and keeps each URL's first occurrence.
- **`D` is a third terminal value**, alongside `R` and `E`. It seals the stack as they do. It is legal as a supplied top-level value and is validated like the todo list in `S`.
- **The operand is exactly one placeholder-free URL.** Any other literal array is `missing_operand` or `invalid_destination`. This also refuses aliases (`~x` is not a URL), so no alias rule is needed. URLs are compared as strings, with no URL normalization. A duplicate `.todo` and a `.done` on an absent URL are no-ops that still end in `D`. Focus plays no part.
- **No done flag.** The bounded history is the undo.

## Considered options

- **Targets under a reserved dimension (`todo`).** Rejected: every item would need its own unique key, and items would turn up in ordinary searches. It would also make "a link to look at later" a target, which is a different concept.
- **A separate localStorage record.** Rejected: it would sit outside history, revert, import, and merge, and the language could not change it.
- **An optional `todo` field on `R`.** Rejected: every reader of `R` would have to know that `matches` is meaningless in that mode. A new sigil keeps `R` to one meaning and lets the client tell the outcomes apart by element 0.
- **Items as notes or saved queries.** Rejected for now: a note needs multiword literals, which the language lacks. A saved query depends on targets that may change, and opening it can end on a fallback page. A bare URL is predictable, and the item shape can grow later.
- **A done flag or archive.** Rejected: the core has no clock, and the list would become a log to prune.

## Consequences

- **Older pages reject the new shape.** An `S` carrying `todo` is a `parse_error` on a page released before this decision, because a supplied `S` refuses unknown fields. Importing a newer stack into an older page fails, and so does rolling the deployed tag back once todos exist. No migration is provided; Settings' clear and import are the escape hatch.
- **`.save` writes on a `D` as well as an `R`.** A `D`, like an `R`, proves the operation consumed its literal array, so the stored stack is one `.load` can read.
- **The trailing `.$` is absorbed.** The browser client's trailing `.$` meets a stack already sealed by `D`.
- **`.todo` and `.done` make a program nontrivial**, so a todo program waits for Enter, including one arriving through a URL ([ADR 0015](0015-nontrivial-programs-run-on-enter.md)).
- **Saving a search result is not supported yet.** A rendered destination can be saved only by typing or pasting its URL.
