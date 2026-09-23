import type { Dim, ErrorType, Stack, StackValue, Template, ThitherError } from './types';

export const thitherError = (
  type: ErrorType,
  description: string,
  fields?: Record<string, unknown>,
): ThitherError => ['E', { type, description, ...fields }];

// dsl.md §1 — the terminal seal: nothing lands on top of R or E; literals merge into L
export const push = (stack: Stack, value: StackValue): Stack => {
  const top = stack[stack.length - 1];

  if (!top) {
    stack.push(value);
    return stack;
  }

  const [topSigil, topToken] = top;
  const [sigil, token] = value;

  switch (topSigil) {
    case 'R':
    case 'E':
      return stack;

    default:
      if (topSigil === 'L' && sigil === topSigil) {
        stack[stack.length - 1] = ['L', [...topToken, ...token]];
      } else {
        stack.push(value);
      }

      return stack;
  }
};

// The core omits the DOM lib, which drops `URL`'s type with it; see
// docs/code-standards.md "Layout" on universal platform globals.
declare const URL: { parse(url: string): unknown | null };

// dsl.md §2 — render every {} to a probe, then require the WHATWG parser to accept it
export const isTemplate = (value: string): value is Template => {
  try {
    const parsed = URL.parse(value.split('{}').join('thither'));
    return parsed !== null;
  } catch (_ex) {
    return false;
  }
};

// dsl.md §3 — stored dimensions: trimmed, lowercase, deduplicated, UTF-16 sorted
export const normalizeDimensions = (dims: readonly Dim[]): Dim[] => {
  return [...new Set(dims.map((it) => it.trim().toLowerCase()))].sort();
};
