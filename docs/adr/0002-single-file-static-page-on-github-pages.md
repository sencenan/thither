# Ship as a single self-contained HTML page on GitHub Pages

Axon is written in TypeScript and built with Vite plus `vite-plugin-singlefile` into one `index.html` with all JavaScript and CSS inlined, published on GitHub Pages. The alternative was a conventional multi-asset static bundle, or an app with a server-side interpreter. A single file keeps the interpreter fully client-side, makes the artifact trivially portable (it can be opened from disk or re-hosted anywhere), and removes any runtime dependency on a CDN or backend.

## Consequences

- No runtime code may be loaded from a CDN; dependencies such as the `fzf` port must be bundled.
- Caching granularity is the whole page, and the build must verify the deployable output really is self-contained.
