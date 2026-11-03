# Checkpoint: the todo list is usable

Type: grilling
Status: resolved
Blocked by: 03

## Question

Drive the todo list on the dev server and sign off, or file follow-ups.

- `.todo` on a blank state shows "No todos". `https://a .todo` then `https://b .todo` lists a then b. Adding `https://a` again leaves the list unchanged.
- From `?q=https://a%20.todo` the page waits for Enter, then saves the URL and doesn't navigate.
- On a row: Enter opens it, Ctrl+1 opens it, and Right puts the URL in the field. Typing ` .done` and pressing Enter removes it, and the todo view returns.
- Errors: `https://x/{} .todo`, `~a .todo`, and `a b .todo` show `invalid_destination`, `invalid_destination`, and `missing_operand`.
- Settings: revert undoes a `.done`; exporting a stack and importing it again keeps the todos.
- `.merge` behaviour through the REPL.
- Settle the map's Fog: does the todo view need more distinction than the summary bar text?

## Answer

The human drove the todo view on the dev server. One change was asked for: make it obvious the page is showing the todo list, not search results. The summary bar now carries a "Todo list" label in the accent colour, on a bar tinted to match, and the count reads `N items`. `browser-client.md` was amended to match. This settles the map's Fog.

The human then asked to merge, which is taken as sign-off. The checklist items above were not reported back one by one.
