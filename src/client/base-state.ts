// browser-client.md "Execution flow" — the client base state: the state every run places beneath
// the stored one, holding a single arity-0 target keyed `thither` that opens this page.

import type { State } from '../dsl/index.ts';

// `href` rather than `origin + pathname`: a `file:` URL's origin is the string "null". The URL
// parser percent-encodes `{` and `}` in a path, so the page can never read as a placeholder.
export const baseState = (pageUrl: string): State => {
  const page = new URL(pageUrl);
  page.search = '';
  page.hash = '';
  return ['S', { targets: { thither: [page.href] }, focus: [], alias: {} }];
};
