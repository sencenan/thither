# Help modal and a larger gear control

Type: task
Status: claimed
Blocked by:

## Question

Two more fallback-UI asks from hand-driving the S5 checkpoint (ticket 41):

1. **Larger gear.** The Settings gear button is too small; make it bigger.
2. **A comprehensive help affordance.** Beyond the empty-target-set setup instructions
   (which vanish once a target exists), add an always-available way to show usage, the
   language's basic rules, and setup. A modal was the leading suggestion.

Feeds the S5 checkpoint (41).

## Answer

1. **Field controls redesigned.** A text `?` beside the gear glyph looked mismatched and
   detached, so both became consistent inline SVG line-icons (`src/client/icons.ts`,
   `iconMarkup('help' | 'settings')`). Each icon carries its own `viewBox` and `strokeWidth`;
   the wrapper supplies `fill=none`, `currentColor` stroke, and rounded joins, so CSS colour and
   the box size drive them. The gear uses a padded `-5 -5 74 74` viewBox and `strokeWidth 6.2` so
   its teeth fill the same ~83% of the box (and the same on-screen line weight) as the help
   circle — they read at one size. `fallback-page.ts` groups them in a `.controls` cluster at the
   field's end behind a hairline divider; `style.css` sizes both `.field-control` boxes `34 × 34`
   with an `18px`, `overflow: visible` svg, and tightens the field padding.
   (Icons set via `innerHTML`; happy-dom parses the SVG namespace, asserted in the tests.)
   *(The original ask was "larger gear"; on review it also looked mismatched and detached, so
   the whole two-button cluster was reworked to consistent icons rather than only enlarged.)*
2. New `src/client/help.ts` `createHelpDialog(doc): { element, open(pageUrl) }` — a `<dialog>`
   with **Usage**, **Basic rules**, and **Setup** sections. Usage covers searching, arguments
   after the `.` separator, opening (auto / Enter / `Ctrl+digit` / click), and Escape-to-clear;
   Basic rules cover `.set`/`.rm`/`.@`/`.$`, search operators, and escaping; Setup reuses
   `shortcutTemplates` (now exported from `setup-instructions.ts`) to show this page's two
   shortcut templates plus the example `.set`. It is always reachable, unlike the setup
   instructions. `fallback-page.ts` adds a `?` `.help-control` beside the gear, opens the dialog
   with `location.href`, refocuses the field on close, and the document `keydown` handler now
   bails while **either** dialog is open. `style.css` styles `dialog.help`.

`browser-client.md` "Fallback UI and settings" amended (Help control paragraph). Tests:
`help.test.ts` (sections, four operations, per-open template refresh, close) and fallback-page
cases (the `?` opens Help, the keyboard bails while Help is open, close refocuses).
`pnpm verify` green.
