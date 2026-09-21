# Free online storage for Axon state

> **Outcome:** deferred. The first client keeps all state in browser localStorage, with no remote storage or synchronization; see [ADR 0001](../adr/0001-localstorage-only-browser-client.md). This note remains as background for any future shared-state work.

## Scope and recommendation

Question: can Axon's static browser client and CLI keep `S` online without operating a custom backend?

Yes, by using an existing authenticated storage API. This preserves static application hosting; it does not eliminate the remote service dependency. The following are candidates, not adopted architecture decisions.

**Recommendation for a personal, developer-oriented first version:** investigate one `state.json` file in a private GitHub repository, with explicit pull/push initially. It offers private storage, version history, and a browser-accessible API. For a general-user product, compare Google Drive app data against an Axon-managed Supabase project before choosing an authentication flow.

## Candidates

### Private GitHub repository

- GitHub Free includes unlimited private repositories with a limited feature set. [1]
- The Contents API reads files and creates or updates file content. Updates require the SHA of the file being replaced; the endpoint documents conflict responses and requires Contents write permission for fine-grained tokens. This provides a basis for detecting stale writes, not automatic merging. [2]
- GitHub's REST API explicitly supports CORS requests from any origin, so browser requests need not inherently pass through an Axon proxy. Authentication still needs a separate design. [3]
- Proposed representation: a single `state.json`. Only actual state changes should produce writes; searching alone should not create commits. This is an Axon design recommendation, not a provider requirement.
- For a personal experiment, a user-supplied, repository-scoped token is possible. Do not embed a shared write credential in the public JavaScript bundle. A polished browser/CLI authorization flow remains untested and undecided.

### GitHub Gist

- The Gists REST API supports creating, reading, and updating files. [4]
- **Secret gists are not private:** anyone who discovers the URL can read them. GitHub itself recommends a private repository for private content. [5]
- Assessment: convenient for intentionally shareable target sets; unsuitable as the default for confidential state without an additional encryption design. Secret URL visibility is not user authentication.

### Google Drive application data

- Drive has a hidden, application-specific folder designed for configuration data. It uses the non-sensitive `drive.appdata` OAuth scope. The folder is accessible only to the owning app, is not shown in the normal Drive UI, and cannot be shared. Users can delete its data. [6]
- Google supports browser-side access tokens and authenticated REST/CORS calls. Its browser token model requires acquiring fresh access tokens, with user-gesture considerations; it is not a permanent credential that can simply be hardcoded into a static app. [7]
- The inspected limits page says standard Drive API use is available at no additional cost, but also describes quotas and planned charges above limits. Therefore this is a free-within-limits candidate, not an unlimited or permanently free guarantee. Account storage availability must also be checked before adoption. [8]
- Assessment: a good conceptual fit for “each user keeps their own private state.” OAuth project setup and accessing the same app data from browser and CLI need a proof of concept; that integration was not tested here.

### Supabase Free

- The inspected pricing page lists a $0 plan with a 500 MB database, 50,000 monthly active users, and 5 GB egress. Free projects pause after one week of inactivity; two active projects are allowed. [9]
- Supabase documents browser-to-database access using Auth plus row-level security (RLS). Exposed tables require appropriate grants and policies. Administrative secret/service-role keys must not be exposed in the browser. [10]
- Proposed representation: one row per user containing state JSON and a revision. Authenticated ownership policies restrict reads and writes; a conditional revision update would prevent silent stale overwrites. This schema and concurrency policy are suggestions, not built-in behavior obtained merely by choosing Supabase.
- Assessment: more natural for an Axon-operated, multi-user service. No custom application server is necessary for basic state CRUD, but Axon still owns a backend project, its policies, and its quota exposure.

## Design consequences independent of provider

These are recommendations and questions arising from Axon's existing model, not provider promises:

1. **Storage is not synchronization.** If browser and CLI both load version A and independently overwrite it, one can erase the other's changes. Choose conditional writes and a conflict workflow before claiming safe synchronization.
2. **Retain a local copy.** localStorage and the CLI file can continue to support local execution. Explicit pull/push is a smaller initial design than background offline synchronization.
3. **Navigation can interrupt synchronization.** Do not rely on an unfinished remote upload surviving navigation. Either await an acknowledged save or persist a retryable pending change locally and clearly distinguish local saving from remote synchronization.
4. **`S` includes focus, not just targets.** Sharing all of `S` means changing focus in one client changes the state that another client later receives. Whether that is wanted remains unresolved. See [the glossary](../../CONTEXT.md).
5. **Remote read failure is not absence.** Authentication, connectivity, and malformed-data errors must not initialize and upload empty state over existing remote data.
6. **Validate remote envelopes before execution.** Treat remotely loaded state as data; do not concatenate arbitrary remote text into executable DSL source without parsing and validating it as the intended state envelope.
7. **Keep credentials out of `S`.** Tokens belong to client credential handling, not portable target/focus data. Browser XSS or compromised scripts can still compromise user-authorized access; static hosting does not remove this risk.
8. **No free-forever claim.** These are current provider offerings with quotas and policies, not guarantees. Retain export/import and local backups.

No provider was configured, no credentials were requested, and no runtime integration was tested. Findings come from primary documentation; background-agent execution was unavailable.

## Sources

1. [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans).
2. [GitHub repository Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).
3. [GitHub REST API CORS](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests).
4. [GitHub Gists API](https://docs.github.com/en/rest/gists/gists).
5. [GitHub gist visibility](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).
6. [Google Drive application data](https://developers.google.com/workspace/drive/api/guides/appdata).
7. [Google browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).
8. [Google Drive API limits and pricing](https://developers.google.com/workspace/drive/api/guides/limits).
9. [Supabase pricing](https://supabase.com/pricing).
10. [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
