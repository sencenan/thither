# Strip the consumed input from the URL when the fallback page is shown

Type: task
Status: resolved

## Question

`browser-client.md` "Reading input" kept program input in the URL after execution and named reload-replay an execution policy. Dogfooding showed the cost: after `<u> home .set` (or any mutation that ends on the fallback page) the address bar still holds `?q=…`, and an accidental refresh runs the mutation again against the then-current state. Remove `q` from the URL once the fallback page is rendered, so a reload is a blank open rather than a replay.

In scope: a pure `stripInput(url)` beside `readInput` in `src/client/input.ts`, called from `main.ts` through `history.replaceState` on the render path only; record the initial input on the browser env so the UI still has it after the strip; fixtures; amend `browser-client.md`.

Out of scope: the auto-navigation path (`location.replace` leaves the page, so the URL is moot) and the bare error page (nothing executed, nothing to protect against).

## Answer

`stripInput(url): string` deletes `q` from **both** the query and the fragment — both, because `readInput` falls through to the fragment, so stripping only the source that ran would leave a reload executing the other one. Every other query parameter, the path, and a `q`-less fragment are left byte-for-byte; when a source is emptied its `?`/`#` goes too. Ten fixtures plus a round-trip (`readInput(stripInput(url))` is `[]`). `main.ts` calls `history.replaceState(null, '', stripInput(location.href))` immediately before `renderView` in the `.catch` of the navigation chain, so a navigated run never rewrites and a `.load` throw still reaches the bare-error handler with its URL intact.

`browser-client.md` "Reading input" now specifies the strip in place of the keep-and-replay policy, and "Fallback UI" no longer says a reload can redirect automatically — the input is gone, so it opens blank. **The input survives the strip on the env.** `createBrowserEnv(storage, input = [])` now records the tokens as a `readonly input` field on `BrowserEnv` — the browser world is one value, and the program the page opened with is part of that world once its URL no longer holds it. `main.ts` reads the URL once into the env and composes the program from `env.input`; host operations never touch it (fixture: a `.set` run leaves it as opened). S5's live text field seeds from `env.input`, not the address bar. ADR 0005's `createBrowserEnv` sentence updated (it also still listed the long-gone `saved` field).
