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
  type Separator,
  type Target,
  type Template,
  type ThitherError,
  type Token,
} from './types';
import { thitherError } from './utils';

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

    return ['l', token as Dim]; // not escaping .. here, not normalizing
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
  if (isRecord(raw)) {
    const { targets, focus } = raw;

    if (Array.isArray(targets) && isDimList(focus) && targets.every(isTarget)) {
      const normalized = targets.map(normalizeTarget);

      const dimSet = new Set<string>();
      for (const [dims] of normalized) {
        const key = dims.join(' ');
        if (dimSet.has(key)) {
          return createParseError('duplicated targets in State');
        }
        dimSet.add(key);
      }

      return ['S', { targets: normalized, focus: normalizeDimensions(focus) }];
    }
  }

  return createParseError('malformed State');
};

const parseResult = (raw: unknown): Result | ThitherError => {
  if (isRecord(raw)) {
    const { matches, inputs } = raw;

    if (isStringArray(inputs) && Array.isArray(matches) && matches.every(isMatch)) {
      return [
        'R',
        {
          matches: matches.map(([dest, dims, args, hint]) => [dest, dims, args, hint]),
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
  const [dest, dims, args, hint, ...rest] = value;

  return (
    rest.length === 0 &&
    typeof dest === 'string' &&
    isTemplate(dest) &&
    isDimList(dims) &&
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

const isTarget = (value: readonly unknown[]): value is Target => {
  const [dims, dest, ...rest] = value;

  return (
    rest.length === 0 &&
    isStringArray(dims) &&
    isDimList(dims) &&
    typeof dest === 'string' &&
    isTemplate(dest.trim())
  );
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((member) => typeof member === 'string');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isSeparator = (value: string): value is Separator => {
  return value === '.';
};

const isDim = (value: string): value is Dim => {
  value = value.trim();
  return value.length > 0 && !/\s/.test(value) && !isSeparator(value);
};

const isDimList = (value: unknown): value is Literal[] => {
  return isStringArray(value) && value.every(isDim);
};

const isOp = (value: string): value is Op => {
  return value.startsWith('.') && !value.startsWith('..') && !isSeparator(value);
};

const isTemplate = (value: string): value is Template => {
  try {
    const parsed = URL.parse(value.split('{}').join('thither'));
    return parsed !== null;
  } catch (_ex) {
    return false;
  }
};

const isErrorType = (value: unknown): value is ErrorType => {
  return ErrorTypes.some((it) => it === value);
};

// normalizers

const normalizeTarget = (target: Target): Target => {
  const [dims, dest] = target;
  return [normalizeDimensions(dims), dest];
};

const normalizeDimensions = (dims: readonly Dim[]): Dim[] => {
  return [...new Set(dims.map((it) => it.trim().toLowerCase()))].sort();
};
