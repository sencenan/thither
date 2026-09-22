// dsl.md §2 — source syntax, parsing, and supplied structured values

import { describe, expect, it } from 'vitest';
import { parse } from '../parser.ts';
import type { InterpreterEnv, OpFn } from '../types.ts';

const noop: OpFn = (stack) => stack;
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

  it('§2 a double-dot token escapes to a literal, never an operation', () => {
    // The `..` prefix is retained and stripped only when the literal is rendered,
    // so parse yields a literal that still carries both dots.
    expect(parse(env, '..set')).toEqual(['l', '..set']);
    expect(parse(env, '..$')).toEqual(['l', '..$']);
    expect(parse(env, '..')).toEqual(['l', '..']);
  });
});

describe('parse — supplied State (dsl.md §2, §3)', () => {
  it('§3 normalizes target dimensions: trim, lowercase, dedupe, sort', () => {
    const token = parse(
      env,
      frozen([
        'S',
        {
          targets: [[['Git', ' company ', 'git'], 'https://github.com/company/{}']],
          focus: [],
        },
      ]),
    );
    expect(token).toEqual([
      'S',
      { targets: [[['company', 'git'], 'https://github.com/company/{}']], focus: [] },
    ]);
  });

  it('§3 normalizes focus the same way and replaces rather than extends', () => {
    const token = parse(env, frozen(['S', { targets: [], focus: ['Personal', 'personal'] }]));
    expect(token).toEqual(['S', { targets: [], focus: ['personal'] }]);
  });

  it('§3 preserves target-set order', () => {
    const token = parse(
      env,
      frozen([
        'S',
        {
          targets: [
            [['b'], 'https://b.example.com/'],
            [['a'], 'https://a.example.com/'],
          ],
          focus: [],
        },
      ]),
    );
    expect(token).toEqual([
      'S',
      {
        targets: [
          [['b'], 'https://b.example.com/'],
          [['a'], 'https://a.example.com/'],
        ],
        focus: [],
      },
    ]);
  });

  it('§2 stores the original destination text, not the parser-normalized probe', () => {
    const token = parse(
      env,
      frozen(['S', { targets: [[['x'], 'https://Example.COM/{}/Path']], focus: [] }]),
    );
    expect(token).toEqual(['S', { targets: [[['x'], 'https://Example.COM/{}/Path']], focus: [] }]);
  });

  it('§2 duplicate normalized dimension sets make the state invalid', () => {
    const token = parse(
      env,
      frozen([
        'S',
        {
          targets: [
            [['company', 'git'], 'https://github.com/company/{}'],
            [['Git', 'company'], 'https://gitlab.com/company/{}'],
          ],
          focus: [],
        },
      ]),
    );
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§2 a dimension with internal whitespace is invalid, not split into two', () => {
    const token = parse(
      env,
      frozen(['S', { targets: [[['a b'], 'https://example.com/{}']], focus: [] }]),
    );
    expect(token[0]).toBe('E');
    expect(token[1]).toMatchObject({ type: 'parse_error' });
  });

  it('§2 drops unknown fields on the S envelope', () => {
    const token = parse(env, frozen(['S', { targets: [], focus: [], note: 'x' }]));
    expect(token).toEqual(['S', { targets: [], focus: [] }]);
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
      const token = parse(env, frozen(['S', { targets: [[['x'], dest]], focus: [] }]));
      expect(token).toEqual(['S', { targets: [[['x'], dest]], focus: [] }]);
    }
  });

  it('§2 rejects destinations without an explicit scheme', () => {
    for (const dest of ['example.com/path', '/path/{}', '//example.com/{}']) {
      const token = parse(env, frozen(['S', { targets: [[['x'], dest]], focus: [] }]));
      expect(token[0]).toBe('E');
      expect(token[1]).toMatchObject({ type: 'parse_error' });
    }
  });

  it('§2 rejects a malformed State envelope', () => {
    expect(parse(env, frozen(['S', { targets: [] }]))[0]).toBe('E');
    expect(parse(env, frozen(['S', { targets: {}, focus: [] }]))[0]).toBe('E');
  });
});

describe('parse — supplied Result (dsl.md §2, §4.4)', () => {
  it('§4.4 keeps R.inputs in their original spelling', () => {
    const body = {
      matches: [
        [
          'https://github.com/company/MyRepo',
          ['company', 'git'],
          ['MyRepo'],
          { argDelta: 0, positions: [], score: 0 },
        ],
      ],
      inputs: ['Company', 'Git'],
    };
    expect(parse(env, frozen(['R', body]))).toEqual(['R', body]);
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

  it('§6 an E without a string description parses to parse_error', () => {
    const token = parse(env, frozen(['E', { type: 'ambiguous_set' }]));
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
