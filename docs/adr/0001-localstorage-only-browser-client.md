# Browser client stores state in localStorage only

Axon's first client is a browser page whose entire state of the world lives in that browser's localStorage, with no server, account, file, or cross-device synchronization. We considered a hosted backend and free third-party stores (private GitHub repository, Gist, Google Drive app data, Supabase; see [the research notes](../research/online-state-storage.md)), but every option added authentication, quota, and conflict handling before the core idea was validated. Recovery relies on bounded local stack history plus manual reset, not remote backup.

## Consequences

- State is per browser profile and is lost if the user clears site data.
- The browser client is one possible client, not the only intended one; the language core stays client-agnostic so other clients (CLI, shared or remote state) remain possible later.
