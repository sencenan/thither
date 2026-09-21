// browser-client.md "Execution flow" — placeholder entry point.
//
// The client is designed in ticket 16 and assembled in tickets 17-19. This file
// exists so the scaffold can build, bundle, and deploy a page end to end.

const root = document.querySelector("#app");

if (root !== null) {
  root.textContent = "Thither: scaffold only.";
}
