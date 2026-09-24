# Thither

Thither helps people navigate quickly to known web destinations using short dimensions and optional arguments, rather than searching history, bookmarks, or open tabs.

Language syntax and execution rules are specified in [docs/dsl.md](docs/dsl.md).

## Language

### Hosts

**Host**:
The program that embeds the interpreter and composes the programs it runs, such as the browser client or the REPL. The interpreter evaluates exactly what a host gives it and appends nothing.
_Avoid_: Client (when the REPL is included), runtime, shell

**Host operation**:
An operation a host registers on the interpreter's environment beyond the language's own four, such as the browser client's `.load`, `.out`, and `.save`. It is written into the program like any other operation.
_Avoid_: Plugin, hook, built-in

**Output register**:
The host-held slot that host operations write to and that the host reads after execution: the run's terminal `R` or `E`, and facts about the run such as whether the persisted stack changed. The host reads the register, never the returned stack.
_Avoid_: Result variable, side channel

### Targets and matching

**Dimension (dim)**:
A short label used to recall and select a target, such as `company`, `personal`, or `git`. Dimensions are stored lowercase, trimmed, without whitespace, and free of search-operator syntax.
_Avoid_: Tag keyword

**Search operator**:
fzf's extended-search syntax, available on the terms of a search or removal query: `|` between terms for either-or, a leading `!` for must-not-match, a leading `'` for exact substring, a leading `^` and a trailing `$` as anchors. A term carrying an operator is search syntax, never a dimension, so it cannot be stored in a target or in focus.
_Avoid_: Filter, modifier

**Target**:
An association between a set of dimensions and a single destination template. Targets are selected and ranked through fuzzy matching; ranking first does not itself permit direct navigation.
_Avoid_: Navigation mapping

**Target set**:
An ordered collection of targets available for matching and modification, with at most one target for each normalized dimension set. Its order is the last tiebreak between equally good matches, so a newly added target never displaces an existing one.

**Destination template**:
A target's URL pattern whose anonymous `{}` placeholders are filled left-to-right by supplied arguments using literal substitution. A slash in an argument introduces a path segment. A plain URL is a destination template with zero placeholders.

**Argument**:
A single space-separated token supplied to fill one destination template placeholder, rather than to match dimensions. Arguments preserve their original spelling and case.

**Argument separator**:
A standalone `.` token separating the dimension-matching portion of an input from its arguments. For search, the following tokens are arguments; target-setting, removal, and focus-setting ignore the separator and everything after it.

**Match**:
A search-selected target represented with its fully or partially rendered destination, dimensions, applied arguments, and hints. Missing arguments leave their `{}` placeholders intact and prevent direct navigation; the argument balance is recorded in the hints.

**Searchable string**:
A target's dimensions joined into the single piece of text that matching runs against. Each query term is matched against the whole string independently, and a target is selected when every term matches; a single term may therefore match across the boundary between two of a target's dimensions.

**Matching evidence**:
The record of why a target matched, carried by every match: which characters of its searchable string matched, and how strongly the target matched overall. It exists so a result can be explained without matching again, and it is not an instruction about how to display anything.
_Avoid_: Highlights, match metadata

**Match set**:
A collection of matches, including those with missing arguments.

**Argument balance**:
The number of supplied arguments minus the number of required placeholders: negative means missing arguments, positive means extra arguments, and zero means an exact count. Matches with a complete destination come first, and within that the closer a match is to an exact count, the earlier it is listed.

**Search result**:
The matches produced by a search together with the user-supplied dimensions used for matching.

### State and focus

**State of the world**:
The collection of available targets together with the current focus.

**Focus**:
Stored dimensions implicitly combined with the supplied dimensions of target-setting, removal, and search operations. Focus supplies matching context, not an exact namespace or access-control boundary, and being stored dimensions it carries no search operators.

### Navigation

**Fallback page**:
The page shown when an input cannot be resolved to a single destination URL. Multiple fuzzy matches require this page even when one match ranks above the others.
_Avoid_: Backup page
