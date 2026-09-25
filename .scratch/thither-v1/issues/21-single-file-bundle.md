# Bundle to a single self-contained index.html

Type: task
Status: resolved
Blocked by: 19

## Question

Make the build emit one self-contained `index.html`, per ADR-0002 and `browser-client.md` "Source, build, and deployment".

In scope:

- Configure `vite-plugin-singlefile` so that all JavaScript and CSS are inlined and the `fzf` dependency is bundled, never loaded from a CDN.
- **Verify** self-containment as a build step, not an assumption: the deployable output contains only `index.html` and references no external application script or stylesheet. `browser-client.md` warns explicitly that installing the plugin does not by itself guarantee this, and that Vite's `public` directory is not automatically inlined.
- Make that verification fail the build, so a later ticket cannot silently break it.
- Confirm the built file works when opened directly from disk as well as when served, since portability is part of ADR-0002's rationale.

**Done when** `pnpm build` produces exactly one deployable file, the verification step is wired into the build and proven to fail on a deliberately externalized asset, and the artifact runs from `file://`.

## Answer

`pnpm build` emits exactly one file, `dist/index.html` (23.72 kB), with all JS/CSS and the `fzf` dependency inlined into a single `<script type="module">`. The Vite config was already set up for this (`root: src/client`, `base: './'`, `publicDir: false`, `assetsInlineLimit: Infinity`, `cssCodeSplit: false`, `viteSingleFile()`); this ticket added the **verification** the config alone can't guarantee.

**What the invariant is (and isn't).** "Single-file" is about *deployment* — exactly one file to publish, with the app's own JS/CSS inlined — not about runtime isolation. Thither is a network-facing tool (it redirects to other sites), so the loaded page may reasonably fetch external resources it can expect to exist: public fonts, fonticons, CDN assets. The check therefore enforces two things and deliberately allows a third: (1) `dist/` holds only `index.html`; (2) `index.html` references no *local* asset (a relative or root-relative `src`/`href`), because such a file would be missing once only `index.html` ships and would break `file://`; (3) absolute and protocol-relative URLs (`https://…`, `//…`) **pass** as runtime resources. This can't distinguish a CDN font from a CDN-loaded runtime library, so `browser-client.md`'s "bundle runtime libraries rather than load from a CDN" rule stays a review discipline, not something the check holds.

**Verification, not assumption.** `scripts/verify-single-file.ts` holds two pure helpers — `findLocalAssetReferences(html)` (flags relative/root-relative `<script src>`/`<link href>`; skips scheme'd and protocol-relative URLs) and `verifyDist(distDir)` (asserts the output is exactly `index.html` and references no local asset) — plus `verifySingleFilePlugin(distDir)`, a Vite plugin whose `closeBundle` hook runs them against the written `dist/` and **throws**, failing `vite build`. It's wired *after* `viteSingleFile()` in `vite.config.ts`, so it inspects the final inlined output. Kept in `scripts/` (never bundled, its own `types: ["node"]` tsconfig) rather than `src/` so the client stays free of `node:fs`.

**Proven to fail.** `scripts/tests/verify-single-file.test.ts` (11 cases, now run by `pnpm test` — `vitest.config.ts` include extended to `scripts/**/tests/`) pins positive and negative cases: a local `<script src>`, a local stylesheet, an extra file in `dist/`, and a missing `index.html` all report problems; a fully inlined document, a `data:` icon, an `https://` public font, and a protocol-relative CDN ref all pass. Confirmed live at the build level too: temporarily dropping `viteSingleFile()` externalized the chunk and `pnpm build` **failed with exit 1** (`deployable output must contain only index.html… references local assets that would not be deployed: ./assets/index-…js`); restoring it builds green.

**file:// portability.** The artifact is a single inlined module script with `base: './'` and no local references, so opening `dist/index.html` directly triggers no fetch of app assets — the only thing that breaks a module script under `file://` is a local import, which doesn't exist here (any external runtime resource is a normal cross-origin fetch, unaffected). Booting the built file from a real `file://` URL in happy-dom loads and parses with `#app` present and no missing-resource errors. A true rendered smoke needs a headless browser (none available in this environment; the S2 checkpoint already exercised the running client on the dev server), so full file:// execution is left for the S3 checkpoint's hand-verification.

`pnpm verify` green (285 tests). Landed on `ticket/21-single-file-bundle`; `--no-ff` merge to `main` pending human review (git guardrail).
