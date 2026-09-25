// Reads program input from a URL, per browser-client.md "Reading input", and strips it again
// once the fallback page is shown, so a reload does not re-execute a consumed mutation. The
// fallback page's text field is split by the same `tokenize`.
//
// Selection has explicit precedence, decided by *presence* of `q`, not its value:
//   1. the query string's `q`  (an empty `?q=` still counts, and wins);
//   2. otherwise the fragment's `q`;
//   3. otherwise no input.
// Both the query and the fragment's parameter text are parsed with URLSearchParams,
// which decodes exactly once (`+` → space, `%2B` → literal plus). The first `q` of a
// source is taken, and its value is split on whitespace into ordered tokens.

export const tokenize = (value: string): readonly string[] =>
  value.split(/\s+/).filter((token) => token !== '');

// URL.hash carries a leading '#'; the rest is URLSearchParams-encoded parameter text.
const fragmentParams = (hash: string): URLSearchParams =>
  new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

export const readInput = (url: string): readonly string[] => {
  const { search, hash } = new URL(url);

  const query = new URLSearchParams(search);
  if (query.has('q')) {
    return tokenize(query.get('q') ?? '');
  }

  const fragment = fragmentParams(hash);
  if (fragment.has('q')) {
    return tokenize(fragment.get('q') ?? '');
  }

  return [];
};

// Both sources are stripped, not just the one that ran: a reload would otherwise fall through
// to the fragment's `q`. Sources without `q` are left byte-for-byte as they were.
export const stripInput = (url: string): string => {
  const stripped = new URL(url);

  const query = new URLSearchParams(stripped.search);
  if (query.has('q')) {
    query.delete('q');
    stripped.search = query.toString();
  }

  const fragment = fragmentParams(stripped.hash);
  if (fragment.has('q')) {
    fragment.delete('q');
    stripped.hash = fragment.toString();
  }

  return stripped.href;
};
