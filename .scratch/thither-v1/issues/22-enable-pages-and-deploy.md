# Enable GitHub Pages and deploy

Type: task
Status: resolved
Blocked by: 20, 21

## Question

Get the built page live at a stable public URL on GitHub Pages for `sencenan/thither`. This is the manual, account-bound work that the deploy workflow cannot do for itself.

The agent drives what it can: confirming the workflow authored in ticket 02 still matches the build, cutting the first `v*` tag that triggers it (per [ADR 0004](../../../docs/adr/0004-publish-by-tag.md), a merge to `main` publishes nothing), and reading its logs. The human does the parts requiring repo settings — enabling Pages, selecting the GitHub Actions source, and granting the workflow its `pages` and `id-token` permissions if not already set. Hand them a precise checklist rather than a description; consult the `wizard` skill if the steps are fiddly enough to justify a script.

Record on this ticket, because later tickets depend on them: the live URL, the two search-shortcut templates filled in with it (`https://<host>/<path>/?q=%s` and `https://<host>/<path>/#q=%s`), and anything about the deploy that differs from what the workflow assumed.

**Done when** the deployed page loads at its public URL, serves the single-file artifact, and executes a program end to end in a real browser — having been published by a tag, which also confirms the tag trigger works.

## Comments

### Agent-driven parts (session claiming this ticket)

Everything the agent can do without repo write access is confirmed:

- **Pages is already enabled.** `GET repos/sencenan/thither/pages` returns `build_type: "workflow"` (source = GitHub Actions), `public: true`, `https_enforced: true`, `html_url: https://sencenan.github.io/thither/`. So the human's repo-settings step from the ticket body is *already done* — no need to enable Pages or pick a source. `status: null` and no `builds/latest` (404): nothing has deployed yet because no `v*` tag has been pushed.
- **Workflow matches the build.** `.github/workflows/deploy.yml` triggers on `tags: ["v*"]` (ADR-0004), already grants `pages: write` + `id-token: write`, runs `pnpm run build`, and uploads `dist/`. `pnpm run build` emits exactly one file, `dist/index.html` (23.7 kB, JS/CSS/fzf inlined). Nothing differs from what the workflow assumed.
- **`main` is ready to tag.** HEAD is `4160b4f` (ticket 21's single-file build merged). No tags exist yet.

**The agent cannot finish this ticket.** The authenticated git/gh account (`chenhan-beacon`) has `admin:false, push:false` on `sencenan/thither`, so it cannot push the release tag, and the live-page browser verification is inherently human. Handed to the human below.

### Live URL and shortcut templates

- **Live URL:** `https://sencenan.github.io/thither/`
- **Query template:** `https://sencenan.github.io/thither/?q=%s`
- **Fragment template:** `https://sencenan.github.io/thither/#q=%s`

### Human checklist — publish and verify

Run from a clone with push access to `sencenan/thither` (the repo owner's credentials, not this session's account):

1. **Be on the merged `main`:** `git checkout main && git pull` — confirm HEAD is `4160b4f` or later.
2. **Cut the first release tag** (package.json is `1.0.0`):
   `git tag v1.0.0 && git push origin v1.0.0`
   Per ADR-0004 this — not a merge — is what publishes.
3. **Watch the deploy:** `gh run watch` (or `gh run list --workflow=deploy.yml`). The `verify` job (reused CI) must pass, then `deploy` runs `configure-pages` → `upload-pages-artifact` → `deploy-pages`.
4. **Verify live in a real browser** at `https://sencenan.github.io/thither/`:
   - the page loads and is a single self-contained document;
   - a program runs end to end, e.g. open `https://sencenan.github.io/thither/?q=example` and confirm it executes (empty state → setup instructions, or a real `.set`/`.$` flow if you seed a target first).
5. **Report back** anything that differed from the assumptions above (custom domain, path, permissions surprises) so this ticket's answer can be finalized and the S3 items that depend on the live URL can proceed.

Once step 4 passes, this ticket resolves (append `## Answer`, set `Status: resolved`, add the gist to the map's Decisions so far).

### Update: agent published and verified end to end (gh profile switched to `sencenan`, admin+push)

The owner switched the active gh account to `sencenan` (admin, push), so the agent drove the whole publish rather than handing off a checklist.

## Answer

**The page is live at `https://sencenan.github.io/thither/`, serving the single-file artifact, and executed a program end to end in real headless Chrome — published by the `v1.0.0` tag, which confirms the tag trigger.**

### Live URL and shortcut templates

- **Live URL:** `https://sencenan.github.io/thither/`
- **Query shortcut:** `https://sencenan.github.io/thither/?q=%s`
- **Fragment shortcut:** `https://sencenan.github.io/thither/#q=%s`

### What was published

- Pushed the ticket-21 merge (`4160b4f`) plus two CI fixes to `main`, then tagged `v1.0.0` on `9c5975c`. Per ADR-0004 the tag is what published; no merge did.
- Deploy run succeeded: `verify` (reused CI) green, then `configure-pages` → `upload-pages-artifact` → `deploy-pages`.
- The served `index.html` is **byte-identical** to the local `pnpm run build` output (23,729 bytes): one inlined `<script type="module">`, `#app` root, **zero local asset references**.
- **End-to-end proof in a real browser:** headless Chrome loaded `…/?q=example`, the app booted, ran `.load example .$ .out .save` against the fresh empty stored state, and rendered the output register (`No matches.` — correct for an empty target set at this stage; the setup-instructions render is an S5 feature).

### What differed from what the deploy workflow assumed (three fixes, all on `main` before the successful tag)

The workflow authored in ticket 02 and the S0-checkpoint-deferred pnpm question both bit here; the first two tag attempts failed:

1. **`pnpm/action-setup` could not resolve a pnpm version** — `devEngines.packageManager` alone isn't read by the action. Added a top-level `"packageManager": "pnpm@11.27.1"` (commit `a16e4e5`). This settles the S0 checkpoint's deferred *"CI pnpm-version resolution on a real runner"* item: **a top-level `packageManager` field is required.**
2. **CI called a non-existent `pnpm run check`** — the script had been renamed to `lint` (`biome check`) during a later refactor, leaving `ci.yml` stale. Pointed the step at `pnpm run lint` and aligned `devEngines` to `11.27.1` to silence the version-mismatch warning (commit `9c5975c`).
3. **The `github-pages` environment rejected the tag** — its deployment-branch policy allowed only the `main` branch. Added a `tag` policy `v*` via `gh api …/environments/github-pages/deployment-branch-policies` so `v*` tags may deploy. This is repo config, not in-tree; **future `v*` releases now deploy without further settings changes.**

Pages itself was already enabled (source = GitHub Actions, HTTPS enforced, public) before this ticket, so no enable step was needed.

**Note for S3 checkpoint / later work:** the true rendered file:// smoke deferred by ticket 21 is now moot for the live path — the page renders and executes over HTTPS from Pages. The `docs/search-shortcut-checklist.md` (`%s` substitution of `#`, `&`, `+` across browsers) remains S6 and can now use the live URL above.
