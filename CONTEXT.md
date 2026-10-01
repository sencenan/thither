# Thither

Thither helps people navigate quickly to known web destinations using short dimensions and optional arguments, rather than searching history, bookmarks, or open tabs.

Language syntax and execution rules are specified in [docs/dsl.md](docs/dsl.md).

## Language

### Hosts

**Host**:
The program that embeds the interpreter and composes the programs it runs, such as the browser client or the REPL. The interpreter evaluates exactly what a host gives it and appends nothing.
_Avoid_: Client (when the REPL is included), runtime, shell

**Nontrivial program**:
A program containing any operation other than a single `.$` as its last item, such as one that sets, removes, focuses, or defines an alias. Typed into the fallback page, it runs only when the user presses Enter; any other program is a plain search and runs as it is typed.
_Avoid_: Mutating program, command, write program

**Host operation**:
An operation a host registers on the interpreter's environment beyond the language's own five, such as the browser client's `.load`, `.out`, and `.save`. It is written into the program like any other operation.
_Avoid_: Plugin, hook, built-in

**Output register**:
The host-held slot that host operations write to and that the host reads after execution: the run's terminal `R` or `E`, the state of the world the run left behind, and facts about the run such as whether the stored record loaded. The host reads the register, never the returned stack.
_Avoid_: Result variable, side channel

### Targets and matching

**Dimension (dim)**:
A short label used to recall and select a target, such as `company`, `personal`, or `git`. Dimensions are stored lowercase, trimmed, without whitespace, and free of search-operator syntax.
_Avoid_: Tag keyword

**Search operator**:
fzf's extended-search syntax, available on the terms of a search query: `|` between terms for either-or, a leading `!` for must-not-match, a leading `'` for exact substring, a leading `^` and a trailing `$` as anchors. A term carrying an operator is search syntax, never a dimension, so it cannot be stored in or matched as a key (`.set`, `.rm`); focus, being search input for `.$`, may carry one.
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
A target's normalized dimensions joined into one piece of text. It is the target's identity: target-setting and removal find the target whose key equals theirs exactly, and search's fuzzy matching runs against it. Each query term is matched against the whole key independently, and a target is selected when every term matches; a single term may therefore match across the boundary between two of a target's dimensions.
_Avoid_: Searchable string, dimension string

**Target set**:
A collection of targets available for matching and modification, with at most one target for each key. Ties between equally good matches fall to the order the matcher returns them.

**Destination template**:
A URL pattern whose anonymous `{}` placeholders are filled left-to-right by supplied arguments using literal substitution. A slash in an argument introduces a path segment. A plain URL is a destination template with zero placeholders.

**Argument**:
A single space-separated token supplied to fill one destination template placeholder, rather than to match dimensions. Arguments preserve their original spelling and case.

**Argument separator**:
A standalone `.` token separating the dimension-matching portion of an input from its arguments. For search, the following tokens are arguments. For removal, only their count matters: it names the arity of the variant to remove, disambiguating a target that has more than one. Target-setting and focus-setting ignore the separator and everything after it.

**Match**:
One variant of a search-selected target represented with its fully or partially rendered destination, the variant's template, the target's key, applied arguments, and hints. Missing arguments leave their `{}` placeholders intact and prevent direct navigation; the argument balance is recorded in the hints. The template travels with the rendering so a presentation layer can show which placeholder each argument filled by walking the template, rather than searching the destination.

**Best fit**:
The variant of a selected target whose arity equals the number of supplied arguments; a target has at most one. A selected target always yields one match per variant, but the best fit is distinguished by carrying a zero argument balance, so it leads its target's rows in ordering and is the row a client navigates to. A target without a best fit still lists every variant and can never be navigated to directly.
_Avoid_: Selected variant, default variant

**Matching evidence**:
The record of why a match was found, carried by every match: what was matched against (the key, or the variant's destination template), which of its characters matched, and how strongly. It exists so a result can be explained without matching again, and it is not an instruction about how to display anything.
_Avoid_: Highlights, match metadata

**Destination search**:
The second pass of a search, run only when the query selects no target by key: the same query is matched against each variant's destination template instead. Its matches carry destination evidence and are never navigated to directly.
_Avoid_: Fallback search, URL search

**Match set**:
A collection of matches, including those with missing arguments.

**Argument balance**:
The number of supplied arguments minus a variant's arity: negative means missing arguments, positive means extra arguments, and zero means an exact count. Matches are listed by target, strongest match first; within a target, the exact count leads, then extra arguments, then missing arguments, each closest to exact first.

**Search result**:
The matches produced by a search together with the user-supplied dimensions used for matching.

### State and focus

**State of the world**:
The collection of available targets together with the current focus and the alias definitions.

**Merge**:
Combining two states of the world into one: their targets and alias definitions are united, the later state winning wherever both define a variant of the same arity or the same short form, and the focus is the later state's alone.
_Avoid_: Union, combine, import

**Focus**:
Search terms stored exactly as typed and implicitly prepended to the search query; target-setting and removal never consult it. Focus supplies matching context, not an exact namespace or access-control boundary, and since it is only ever search input it may carry search operators and is never normalized.

**Alias**:
A literal written as `~` followed by a short form, standing for the literal its alias definition gives when typed in focus-setting or search, whether as a search term or an argument; never in target-setting or removal. An alias with no definition is an ordinary literal.
_Avoid_: Alias reference, variable, macro

**Alias definition**:
A short form paired with the literal its alias stands for, part of the state of the world, at most one for each lowercased short form.
_Avoid_: Constant, shortcut


### Navigation

**Fallback page**:
The page shown when an input cannot be resolved to a single destination URL. A search result with more than one match requires this page even when one match ranks above the others, whether the matches come from several targets or from the variants of one.
_Avoid_: Backup page
