# Bundle to a single self-contained index.html

Type: task
Status: open
Blocked by: 19

## Question

Make the build emit one self-contained `index.html`, per ADR-0002 and `browser-client.md` "Source, build, and deployment".

In scope:

- Configure `vite-plugin-singlefile` so that all JavaScript and CSS are inlined and the `fzf` dependency is bundled, never loaded from a CDN.
- **Verify** self-containment as a build step, not an assumption: the deployable output contains only `index.html` and references no external application script or stylesheet. `browser-client.md` warns explicitly that installing the plugin does not by itself guarantee this, and that Vite's `public` directory is not automatically inlined.
- Make that verification fail the build, so a later ticket cannot silently break it.
- Confirm the built file works when opened directly from disk as well as when served, since portability is part of ADR-0002's rationale.

**Done when** `pnpm build` produces exactly one deployable file, the verification step is wired into the build and proven to fail on a deliberately externalized asset, and the artifact runs from `file://`.
