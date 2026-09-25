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
The host-held slot that host operations write to and that the host reads after execution: the run's terminal `R` or `E`, and facts about the run such as whether the stored record loaded. The host reads the register, never the returned stack.
_Avoid_: Result variable, side channel

### Targets and matching

**Dimension (dim)**:
A short label used to recall and select a target, such as `company`, `personal`, or `git`. Dimensions are stored lowercase, trimmed, without whitespace, and free of search-operator syntax.
_Avoid_: Tag keyword

**Search operator**:
fzf's extended-search syntax, available on the terms of a search or removal query: `|` between terms for either-or, a leading `!` for must-not-match, a leading `'` for exact substring, a leading `^` and a trailing `$` as anchors. A term carrying an operator is search syntax, never a dimension, so it cannot be stored in a target; focus, being search input, may carry one.
_Avoid_: Filter, modifier

**Target**:
An association between a set of dimensions and its variants: one destination template per arity, ordered by arity ascending. Targets are selected and ranked through fuzzy matching; ranking first does not itself permit direct navigation.
_Avoid_: Navigation mapping

**Variant**:
One of a target's destination templates, told apart from its siblings by arity alone. A target has at most one variant of each arity, so adding a template whose arity is already present replaces that variant rather than adding another.
_Avoid_: Alternative, version

**Arity**:
The number of anonymous `{}` placeholders in a destination template. A plain URL has arity zero.
_Avoid_: Placeholder count, slot count

**Key**:
A target's normalized dimensions joined into one piece of text. It is the target's identity: target-setting finds the target whose key equals its own exactly, and fuzzy matching runs against it. Each query term is matched against the whole key independently, and a target is selected when every term matches; a single term may therefore match across the boundary between two of a target's dimensions.
_Avoid_: Searchable string, dimension string

**Target set**:
A collection of targets available for matching and modification, with at most one target for each key. Ties between equally good matches fall to the order the matcher returns them.

**Destination template**:
A URL pattern whose anonymous `{}` placeholders are filled left-to-right by supplied arguments using literal substitution. A slash in an argument introduces a path segment. A plain URL is a destination template with zero placeholders.

**Argument**:
A single space-separated token supplied to fill one destination template placeholder, rather than to match dimensions. Arguments preserve their original spelling and case.

**Argument separator**:
A standalone `.` token separating the dimension-matching portion of an input from its arguments. For search, the following tokens are arguments. For removal, only their count matters: it names the arity of the variant to remove. Target-setting and focus-setting ignore the separator and everything after it.

**Match**:
One variant of a search-selected target represented with its fully or partially rendered destination, the target's key, applied arguments, and hints. Missing arguments leave their `{}` placeholders intact and prevent direct navigation; the argument balance is recorded in the hints.

**Best fit**:
The variant of a selected target whose arity equals the number of supplied arguments. A target with a best fit yields exactly one match, for that variant; a target without one yields one match per variant, each rendered as far as the arguments allow, so it can never be navigated to directly.
_Avoid_: Selected variant, default variant

**Matching evidence**:
The record of why a target matched, carried by every match: which characters of its key matched, and how strongly the target matched overall. It exists so a result can be explained without matching again, and it is not an instruction about how to display anything.
_Avoid_: Highlights, match metadata

**Match set**:
A collection of matches, including those with missing arguments.

**Argument balance**:
The number of supplied arguments minus a variant's arity: negative means missing arguments, positive means extra arguments, and zero means an exact count. Matches are listed by target, strongest match first; within a target, the exact count leads, then extra arguments, then missing arguments, each closest to exact first.

**Search result**:
The matches produced by a search together with the user-supplied dimensions used for matching.

### State and focus

**State of the world**:
The collection of available targets together with the current focus.

**Focus**:
Search terms stored exactly as typed and implicitly prepended to the query of search and removal operations; target-setting never consults it. Focus supplies matching context, not an exact namespace or access-control boundary, and since it is only ever search input it may carry search operators and is never normalized.

### Navigation

**Fallback page**:
The page shown when an input cannot be resolved to a single destination URL. A search result with more than one match requires this page even when one match ranks above the others, whether the matches come from several targets or from the variants of one.
_Avoid_: Backup page
