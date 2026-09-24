// Reads program input from a URL, per browser-client.md "Reading input".
//
// Selection has explicit precedence, decided by *presence* of `q`, not its value:
//   1. the query string's `q`  (an empty `?q=` still counts, and wins);
//   2. otherwise the fragment's `q`;
//   3. otherwise no input.
// Both the query and the fragment's parameter text are parsed with URLSearchParams,
// which decodes exactly once (`+` → space, `%2B` → literal plus). The first `q` of a
// source is taken, and its value is split on whitespace into ordered tokens.

const tokenize = (value: string): string[] => value.split(/\s+/).filter((token) => token !== '');

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
