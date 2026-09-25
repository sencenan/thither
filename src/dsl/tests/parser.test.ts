// dsl.md §2 — source syntax, parsing, and supplied structured values

import { describe, expect, it } from 'vitest';
import { parse } from '../parser.ts';
import type { InterpreterEnv, OpFn } from '../types.ts';

const noop: OpFn = (_interp, stack) => stack;
const env: InterpreterEnv = {
  symbols: new Map<string, OpFn>([
    ['.set', noop],
    ['.rm', noop],
    ['.@', noop],
    ['.$', noop],
  ]),
};

const deepFreeze = (value: unknown): void => {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
};
const frozen = <T>(value: T): T => {
  deepFreeze(value);
  return value;
};

describe('parse — string tokens (dsl.md §2)', () => {
  it('§2 standalone `.` is the argument separator, carried as a literal', () => {
    expect(parse(env, '.')).toEqual(['l', '.']);
  });

  it('§2 a dot-prefixed token bound in the environment parses to an operation', () => {
    expect(parse(env, '.set')).toEqual(['o', '.set']);
    expect(parse(env, '.$')).toEqual(['o', '.$']);
  });

  it('§2/§6 an unbound dot-prefixed token parses to missing_operation', () => {
    const token = parse(env, '.bogus');
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'missing_operation' });
  });

  it('§1 an ordinary literal keeps its original spelling and case', () => {
    expect(parse(env, 'Company')).toEqual(['l', 'Company']);
    expect(parse(env, 'MyRepo')).toEqual(['l', 'MyRepo']);
  });

  it('§2 a URL literal accumulates like any other literal, unescaped', () => {
    expect(parse(env, 'https://example.com/{}')).toEqual(['l', 'https://example.com/{}']);
  });

  it('§2 a string token that is empty after trimming is parse_error, not an empty literal', () => {
    for (const raw of ['', '   ', '\t\n']) {
      const token = parse(env, raw);
      expect(token[0]).toBe('E');
      expect(token[1]).toMatchObject({ type: 'parse_error' });
    }
  });

  it('§2 a string token with internal whitespace is parse_error: the core never splits it', () => {
    const token = parse(env, 'company git');
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§2/§3 a token that is only fzf operator syntax is parse_error: the matcher would drop it silently', () => {
    for (const raw of ['!', "'", '^', '^$', "'$", "!'"]) {
      const token = parse(env, raw);
      expect(token[0]).toBe('E');
      expect(token[1]).toMatchObject({ type: 'parse_error' });
    }
  });

  it('§3 operator-decorated terms and the OR token parse as ordinary literals', () => {
    expect(parse(env, '!git')).toEqual(['l', '!git']);
    expect(parse(env, '^git$')).toEqual(['l', '^git$']);
    expect(parse(env, '|')).toEqual(['l', '|']);
    expect(parse(env, '$')).toEqual(['l', '$']);
  });

  it('§2 surrounding whitespace on a string token is trimmed, not rejected', () => {
    expect(parse(env, '  Company  ')).toEqual(['l', 'Company']);
  });

  it('§2 a double-dot token escapes to a literal, never an operation', () => {
    // The `..` prefix is retained and stripped only when the literal is rendered,
    // so parse yields a literal that still carries both dots.
    expect(parse(env, '..set')).toEqual(['l', '..set']);
    expect(parse(env, '..$')).toEqual(['l', '..$']);
    expect(parse(env, '..')).toEqual(['l', '..']);
  });
});

describe('parse — supplied State (dsl.md §2, §3)', () => {
  it('§3 re-normalizes each target key from its dimensions: trim, lowercase, dedupe, sort', () => {
    const token = parse(
      env,
      frozen([
        'S',
        { targets: { 'Git  company git': ['https://github.com/company/{}'] }, focus: [] },
      ]),
    );
    expect(token).toEqual([
      'S',
      { targets: { 'company git': ['https://github.com/company/{}'] }, focus: [] },
    ]);
  });

  it('§3 focus is stored verbatim: neither normalized, deduped, nor reordered', () => {
    const token = parse(env, frozen(['S', { targets: {}, focus: ['Personal', 'personal'] }]));
    expect(token).toEqual(['S', { targets: {}, focus: ['Personal', 'personal'] }]);
  });

  it('§3 focus may carry search operators', () => {
    const token = parse(
      env,
      frozen(['S', { targets: {}, focus: ['!personal', 'git', '|', 'docs'] }]),
    );
    expect(token).toEqual(['S', { targets: {}, focus: ['!personal', 'git', '|', 'docs'] }]);
  });

  it('§2 an empty, whitespace-bearing, or operator-only focus term is invalid', () => {
    for (const term of ['', 'a b', '!', '^$']) {
      const token = parse(env, ['S', { targets: {}, focus: [term] }]);
      expect(token[0]).toBe('E');
      expect(token[1]).toMatchObject({ type: 'parse_error' });
    }
  });

  it('§3 preserves target-set order', () => {
    const token = parse(
      env,
      frozen([
        'S',
        {
          targets: { b: ['https://b.example.com/'], a: ['https://a.example.com/'] },
          focus: [],
        },
      ]),
    );
    expect(token[0]).toBe('S');
    if (token[0] === 'S') {
      expect(Object.keys(token[1].targets)).toEqual(['b', 'a']);
    }
  });

  it('§2 stores the original destination text, not the parser-normalized probe', () => {
    const token = parse(
      env,
      frozen(['S', { targets: { x: ['https://Example.COM/{}/Path'] }, focus: [] }]),
    );
    expect(token).toEqual(['S', { targets: { x: ['https://Example.COM/{}/Path'] }, focus: [] }]);
  });

  it('§2 two keys that normalize to the same text make the state invalid', () => {
    const token = parse(
      env,
      frozen([
        'S',
        {
          targets: {
            'company git': ['https://github.com/company/{}'],
            'Git company': ['https://gitlab.com/company/{}'],
          },
          focus: [],
        },
      ]),
    );
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§2 a target key carrying fzf operator syntax makes the state invalid', () => {
    for (const dim of ['!git', "'git", '^git', 'git$', '|']) {
      const token = parse(env, ['S', { targets: { [dim]: ['https://x/'] }, focus: [] }]);
      expect(token[0]).toBe('E');
      expect(token[1]).toMatchObject({ type: 'parse_error' });
    }
  });

  it('§2 two variants of one target sharing an arity make the state invalid', () => {
    const token = parse(
      env,
      frozen(['S', { targets: { x: ['https://a/{}', 'https://b/{}'] }, focus: [] }]),
    );
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§2 variants are stored in arity-ascending order regardless of supplied order', () => {
    const token = parse(
      env,
      frozen(['S', { targets: { x: ['https://a/{}/{}', 'https://b/{}'] }, focus: [] }]),
    );
    expect(token).toEqual([
      'S',
      { targets: { x: ['https://b/{}', 'https://a/{}/{}'] }, focus: [] },
    ]);
  });

  it('§2 drops unknown fields on the S envelope', () => {
    const token = parse(env, frozen(['S', { targets: {}, focus: [], note: 'x' }]));
    expect(token).toEqual(['S', { targets: {}, focus: [] }]);
  });

  it('§2 accepts destinations with an explicit scheme and {} placeholders', () => {
    const accepted = [
      'https://{}.example.com/{}',
      'file:///tmp/{}',
      'mailto:{}',
      '{}://example.com',
      'https://example.com/',
    ];
    for (const dest of accepted) {
      const token = parse(env, frozen(['S', { targets: { x: [dest] }, focus: [] }]));
      expect(token).toEqual(['S', { targets: { x: [dest] }, focus: [] }]);
    }
  });

  it('§2 rejects destinations without an explicit scheme', () => {
    for (const dest of ['example.com/path', '/path/{}', '//example.com/{}']) {
      const token = parse(env, frozen(['S', { targets: { x: [dest] }, focus: [] }]));
      expect(token[0]).toBe('E');
      expect(token[1]).toMatchObject({ type: 'parse_error' });
    }
  });

  it('§2 rejects a malformed State envelope', () => {
    expect(parse(env, frozen(['S', { targets: {} }]))[0]).toBe('E');
    expect(parse(env, frozen(['S', { targets: 'wrong', focus: [] }]))[0]).toBe('E');
    expect(parse(env, frozen(['S', { targets: { x: [] }, focus: [] }]))[0]).toBe('E');
  });
});

describe('parse — supplied Result (dsl.md §2, §4.4)', () => {
  it('§4.4 keeps R.inputs in their original spelling and m carries the template and the key', () => {
    const body = {
      matches: [
        [
          'https://github.com/company/MyRepo',
          'https://github.com/company/{}',
          'company git',
          ['MyRepo'],
          { argDelta: 0, positions: [], score: 0 },
        ],
      ],
      inputs: ['Company', 'Git'],
    };
    expect(parse(env, frozen(['R', body]))).toEqual(['R', body]);
  });

  it('§1 rejects a match without the template slot, or whose template is not a destination', () => {
    const hint = { argDelta: 0, positions: [], score: 0 };
    const fourSlots = ['https://github.com/company/MyRepo', 'company git', ['MyRepo'], hint];
    const badTemplate = [
      'https://github.com/company/MyRepo',
      'company/{}',
      'company git',
      ['MyRepo'],
      hint,
    ];
    expect(parse(env, frozen(['R', { matches: [fourSlots], inputs: [] }]))[0]).toBe('E');
    expect(parse(env, frozen(['R', { matches: [badTemplate], inputs: [] }]))[0]).toBe('E');
  });

  it('§2 drops unknown fields on the R envelope', () => {
    const token = parse(env, frozen(['R', { matches: [], inputs: [], extra: 1 }]));
    expect(token).toEqual(['R', { matches: [], inputs: [] }]);
  });

  it('§2 rejects a malformed Result envelope', () => {
    expect(parse(env, frozen(['R', { matches: 'nope', inputs: [] }]))[0]).toBe('E');
    expect(parse(env, frozen(['R', { inputs: [] }]))[0]).toBe('E');
  });
});

describe('parse — supplied Error (dsl.md §2, §6)', () => {
  it('§6 keeps a valid type and description and preserves extra diagnostic fields', () => {
    const token = parse(
      env,
      frozen(['E', { type: 'invalid_destination', description: 'bad url', detail: 42 }]),
    );
    expect(token).toEqual([
      'E',
      { type: 'invalid_destination', description: 'bad url', detail: 42 },
    ]);
  });

  it('§2/§6 an E whose type is outside the vocabulary parses to parse_error', () => {
    const token = parse(env, frozen(['E', { type: 'from_the_future', description: 'x' }]));
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§6 the retired ambiguous_set type is outside the vocabulary and parses to parse_error', () => {
    const token = parse(env, frozen(['E', { type: 'ambiguous_set', description: 'x' }]));
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§6 an E without a string description parses to parse_error', () => {
    const token = parse(env, frozen(['E', { type: 'invalid_destination' }]));
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });
});

describe('parse — values never permitted at top level (dsl.md §1, §2)', () => {
  const cases: [string, unknown][] = [
    ['a bare literal array', ['L', ['git']]],
    ['a raw target', [['company', 'git'], 'https://github.com/company/{}']],
    ['an unknown sigil', ['X', {}]],
    ['a number', 42],
    ['null', null],
    ['a plain object', { targets: [] }],
  ];

  it.each(cases)('§1/§2 %s parses to parse_error', (_name, input) => {
    const token = parse(env, frozen(input));
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });
});
