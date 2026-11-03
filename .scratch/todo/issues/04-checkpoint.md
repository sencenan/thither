# Checkpoint: the todo list is usable

Type: grilling
Status: ready-for-human
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
