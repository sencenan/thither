import {
  type Dim,
  type ErrorType,
  ErrorTypes,
  type Hint,
  type InterpreterEnv,
  type Literal,
  type Match,
  type Op,
  type Result,
  SEP,
  SEP_ESCAPE,
  type Separator,
  type Template,
  type ThitherError,
  type Token,
} from './types.ts';
import {
  arityOf,
  isOperatorOnly,
  isOperatorTerm,
  isTemplate,
  keyOf,
  thitherError,
} from './utils.ts';

export const parse = (env: InterpreterEnv, raw: unknown): Token => {
  if (typeof raw === 'string') {
    const token = raw.trim();

    if (isSeparator(token)) {
      return ['l', token];
    }

    if (isOp(token)) {
      if (env.symbols.has(token)) {
        return ['o', token];
      }

      return [
        'E',
        {
          type: 'missing_operation',
          description: `operation ${token} not found`,
        },
      ];
    }

    // dsl.md §2 — one token is one literal: empty or whitespace-bearing text is not a value.
    if (!isDim(token)) {
      return createParseError(`'${raw}' is not a single literal`);
    }

    // dsl.md §2/§3 — a token that is only fzf operator syntax (`!`, `'`, `^`, `^$`) would be
    // dropped silently by the matcher, turning `! .rm` into "remove everything". Reject it.
    if (isOperatorOnly(token)) {
      return createParseError(`'${raw}' is search syntax with no text to match`);
    }

    return ['l', token]; // not escaping .. here, not normalizing
  }

  if (Array.isArray(raw)) {
    const [sigil, body] = raw;

    switch (sigil) {
      case 'S':
        return parseState(body);
      case 'R':
        return parseResult(body);
      case 'E':
        return parseError(body);
    }
  }

  return createParseError('unknown token');
};

const parseState = (raw: unknown): Token => {
  if (!isRecord(raw)) {
    return createParseError('malformed State');
  }

  const { targets, focus } = raw;
  if (!isRecord(targets) || !isFocusList(focus)) {
    return createParseError('malformed State');
  }

  // §2/§3 — re-normalize each supplied key from its dimensions; duplicates after normalization,
  // an empty key, or a key carrying operator syntax make the state invalid. Variants are validated
  // as destinations, must not share an arity, and are stored in arity-ascending order.
  const normalized: Record<string, readonly Template[]> = {};
  for (const [rawKey, variants] of Object.entries(targets)) {
    const dims = rawKey.split(/\s+/).filter((dim) => dim.length > 0);
    if (dims.length === 0 || dims.some(isOperatorTerm)) {
      return createParseError('invalid target key');
    }

    if (
      !Array.isArray(variants) ||
      variants.length === 0 ||
      !variants.every((variant) => typeof variant === 'string' && isTemplate(variant.trim()))
    ) {
      return createParseError('malformed target variants');
    }

    const arities = variants.map(arityOf);
    if (new Set(arities).size !== arities.length) {
      return createParseError('two variants of one target share an arity');
    }

    const key = keyOf(dims);
    if (key in normalized) {
      return createParseError('duplicated targets in State');
    }
    normalized[key] = [...variants].sort((a, b) => arityOf(a) - arityOf(b));
  }

  return ['S', { targets: normalized, focus: [...focus] }];
};

const parseResult = (raw: unknown): Result | ThitherError => {
  if (isRecord(raw)) {
    const { matches, inputs } = raw;

    if (isStringArray(inputs) && Array.isArray(matches) && matches.every(isMatch)) {
      return [
        'R',
        {
          matches: matches.map(([dest, key, args, hint]) => [dest, key, args, hint]),
          inputs,
        },
      ];
    }
  }

  return createParseError('malformed Result');
};

const parseError = (err: unknown): Token => {
  if (
    isRecord(err) &&
    ErrorTypes.some((it) => it === err.type) &&
    typeof err.description === 'string'
  ) {
    const { type, description } = err;

    if (isErrorType(type) && typeof description === 'string') {
      return ['E', { type, description, ...err }];
    }
  }

  return createParseError('malformed Error');
};

const createParseError = (description: string): ThitherError =>
  thitherError('parse_error', description);

const isMatch = (value: readonly unknown[]): value is Match => {
  const [dest, key, args, hint, ...rest] = value;

  return (
    rest.length === 0 &&
    typeof dest === 'string' &&
    isTemplate(dest) &&
    typeof key === 'string' &&
    isDimList(args) &&
    isHint(hint)
  );
};

const isHint = (value: unknown): value is Hint => {
  return (
    isRecord(value) &&
    typeof value.argDelta === 'number' &&
    typeof value.score === 'number' &&
    Array.isArray(value.positions) &&
    value.positions.every((it) => typeof it === 'number')
  );
};

// dsl.md §3 — focus is stored verbatim, but each term must still be a valid single literal:
// non-empty, whitespace-free, and not operator-only. Operators are legal (focus is a search
// prefix), so unlike a target key the operator syntax itself is not rejected here.
const isFocusList = (value: unknown): value is Dim[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (term) =>
        typeof term === 'string' &&
        term.length > 0 &&
        !/\s/.test(term) &&
        term !== SEP &&
        !isOperatorOnly(term),
    )
  );
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((member) => typeof member === 'string');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isSeparator = (value: string): value is Separator => {
  return value === SEP;
};

const isDim = (value: string): value is Dim => {
  value = value.trim();
  return value.length > 0 && !/\s/.test(value) && !isSeparator(value);
};

const isDimList = (value: unknown): value is Literal[] => {
  return isStringArray(value) && value.every(isDim);
};

const isOp = (value: string): value is Op => {
  return value.startsWith(SEP) && !value.startsWith(SEP_ESCAPE) && !isSeparator(value);
};

const isErrorType = (value: unknown): value is ErrorType => {
  return ErrorTypes.some((it) => it === value);
};
