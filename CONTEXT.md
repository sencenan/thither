# Axon

Axon helps people navigate quickly to known web destinations using short dimensions and optional arguments, rather than searching history, bookmarks, or open tabs.

Language syntax and execution rules are specified in [docs/dsl.md](docs/dsl.md).

## Language

### Targets and matching

**Dimension (dim)**:
A short label used to recall and select a target, such as `company`, `personal`, or `git`. Dimensions are stored lowercase, trimmed, and without whitespace.
_Avoid_: Tag keyword

**Target**:
An association between a set of dimensions and a single destination template. Targets are selected and ranked through fuzzy matching; ranking first does not itself permit direct navigation.
_Avoid_: Navigation mapping

**Target set**:
A collection of targets available for matching and modification, with at most one target for each normalized dimension set.

**Destination template**:
A target's URL pattern whose anonymous `{}` placeholders are filled left-to-right by supplied arguments using literal substitution. A slash in an argument introduces a path segment. A plain URL is a destination template with zero placeholders.

**Argument**:
A single space-separated token supplied to fill one destination template placeholder, rather than to match dimensions. Arguments preserve their original spelling and case.

**Argument separator**:
A standalone `?` token separating the dimension-matching portion of an input from its arguments. For search, the following tokens are arguments; target-setting, removal, and focus-setting ignore the separator and everything after it.

**Match**:
A search-selected target represented with its fully or partially rendered destination, dimensions, applied arguments, and hints. Missing arguments leave their `{}` placeholders intact and prevent direct navigation; the argument balance is recorded in the hints.

**Match set**:
A collection of matches, including those with missing arguments.

**Argument balance**:
The number of supplied arguments minus the number of required placeholders: negative means missing arguments, positive means extra arguments, and zero means an exact count. Presentation prioritizes exact counts, then extras, then missing arguments.

**Search result**:
The matches produced by a search together with the user-supplied dimensions used for matching.

### State and focus

**State of the world**:
The collection of available targets together with the current focus.

**Focus**:
Stored dimensions implicitly combined with the supplied dimensions of target-setting, removal, and search operations. Focus supplies matching context, not an exact namespace or access-control boundary.

### Navigation

**Fallback page**:
The page shown when an input cannot be resolved to a single destination URL. Multiple fuzzy matches require this page even when one match ranks above the others.
_Avoid_: Backup page
