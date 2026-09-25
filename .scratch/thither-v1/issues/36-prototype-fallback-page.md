# Prototype the fallback page

Type: prototype
Status: open
Blocked by: 33

## Question

What should the fallback page look like, and how should match evidence be presented? Build a throwaway HTML sketch (no interpreter wiring needed; hand-written sample `R`s are fine) covering everything `browser-client.md` "Fallback UI and settings" describes, so the human can react to concrete shapes before the S5 build tickets commit to markup:

- the text field at the top holding the current program input, and where an `E` is shown relative to it;
- the result list in `R.matches` order, with **highlights** rendered from `hint.positions` / `hint.score` — which dimensions matched, which arguments were inserted — and how a non-navigable row (`argDelta < 0`, unfilled `{}`) reads differently from a navigable one;
- the `1`–`9`, `0` shortcut labels beside the first ten rows;
- the empty-target-set setup instructions (both shortcut URL templates and one example `.set` program) in place of the list;
- the Settings control and the modal: the history listed oldest-first, revert / clear / import actions, history-limit field, and what the page shows after an action.

Plain HTML + CSS, no framework; the answer records the decisions (structure, what a highlight looks like, where the modal lives, how many rows before scroll) and links the sketch as an asset. Do not reuse the sketch's markup wholesale in the build tickets — they follow the decisions, not the file.

Skills: `prototype`; `domain-modeling` for any new vocabulary (glossary terms: match, hint, target, variant, key).

**Done when** the human has reacted to the sketch and the recorded decisions are enough for tickets 37–40 to build without re-asking layout questions.
