// dsl.md §1 — evaluation loop: literal accumulation, pushing values, terminal .$

import { describe, expect, it, vi } from 'vitest';
import { createInterpreter } from '../interpreter.ts';
import type { InterpreterEnv, OpFn, Program, State } from '../types.ts';

const identity: OpFn = (stack) => stack;
const envWith = (ops: Record<string, OpFn>): InterpreterEnv => ({
  symbols: new Map<string, OpFn>(Object.entries(ops)),
});

describe('execute — literal accumulation (dsl.md §1)', () => {
  it('§1 accumulates literals without lowercasing, sorting, or deduping', () => {
    // A no-op `.$` isolates accumulation: the raw literal array survives to the top.
    const interp = createInterpreter(envWith({ '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, 'Company');
    interp.pushToken(program, 'git');
    interp.pushToken(program, 'Company');
    expect(interp.execute(program)).toEqual([['L', ['Company', 'git', 'Company']]]);
  });

  it('§1 pushes a state value as its own stack element, not into the literal array', () => {
    const interp = createInterpreter(envWith({ '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, 'git');
    interp.pushToken(program, ['S', { targets: [], focus: [] }]);
    expect(interp.execute(program)).toEqual([
      ['L', ['git']],
      ['S', { targets: [], focus: [] }],
    ]);
  });
});

describe('execute — terminal .$ appending (dsl.md §1)', () => {
  it('§1 appends a terminal .$ when the program does not already end with the .$ operation', () => {
    const dollar = vi.fn(identity);
    const interp = createInterpreter(envWith({ '.$': dollar }));
    const program: Program = [];
    interp.pushToken(program, 'git');
    interp.execute(program);
    expect(dollar).toHaveBeenCalledTimes(1);
  });

  it('§1 does not append a second .$ when the program already ends with the .$ operation', () => {
    const dollar = vi.fn(identity);
    const interp = createInterpreter(envWith({ '.$': dollar }));
    const program: Program = [];
    interp.pushToken(program, 'git');
    interp.pushToken(program, '.$');
    interp.execute(program);
    expect(dollar).toHaveBeenCalledTimes(1);
  });

  it('§1 appending the terminal .$ never mutates the caller’s program', () => {
    const interp = createInterpreter(envWith({ '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, 'git');
    interp.execute(program);
    expect(program).toEqual([['l', 'git']]);
  });

  it('§1 an escaped literal ..$ does not count as a terminal .$', () => {
    const dollar = vi.fn(identity);
    const interp = createInterpreter(envWith({ '.$': dollar }));
    const program: Program = [];
    interp.pushToken(program, '..$');
    interp.execute(program);
    expect(dollar).toHaveBeenCalledTimes(1);
  });
});

describe('execute — operation dispatch (ADR 0005)', () => {
  it('ADR-0005 dispatches a registered operation and adopts its returned stack', () => {
    const dup: OpFn = (stack) => {
      const top = stack[stack.length - 1];
      if (top) {
        stack.push(top);
      }
      return stack;
    };
    const interp = createInterpreter(envWith({ '.dup': dup, '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, 'x');
    interp.pushToken(program, '.dup');
    expect(interp.execute(program)).toEqual([
      ['L', ['x']],
      ['L', ['x']],
    ]);
  });
});

// The real .set/.rm/.@/.$ arrive in tickets 12/13; these fixtures stub operations
// to exercise the terminal seal of dsl.md §1 (steps 4–5) / §7. A stub models a
// real operation: it inspects its operands and only produces a value on a live
// stack. On a sealed stack (top R or E) it has no operand, so it yields nothing
// that survives — exactly as a real op's absorbed E' would.
const state = (focus: readonly string[] = []): State => ['S', { targets: [], focus }];
const pushR: OpFn = (stack) => {
  const top = stack[stack.length - 1];
  if (top && (top[0] === 'R' || top[0] === 'E')) {
    return stack;
  }
  stack.push(['R', { matches: [], inputs: [] }]);
  return stack;
};

describe('execute — terminal seal (dsl.md §1 steps 4–5, §7)', () => {
  it('§1 an R on top seals the stack: S0 git .$ S1 docs .$ keeps the first result', () => {
    const search = vi.fn(pushR);
    const interp = createInterpreter(envWith({ '.$': search }));
    const program: Program = [];
    interp.pushToken(program, state(['a']));
    interp.pushToken(program, 'git');
    interp.pushToken(program, '.$');
    interp.pushToken(program, state(['b']));
    interp.pushToken(program, 'docs');
    interp.pushToken(program, '.$');

    const result = interp.execute(program);

    // The remaining program still runs — the second .$ is dispatched — but the
    // sealed stack absorbs everything: S1, docs, and the second search's output.
    expect(search).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      ['S', { targets: [], focus: ['a'] }],
      ['L', ['git']],
      ['R', { matches: [], inputs: [] }],
    ]);
  });

  it('§6 an explicit E is pushed as-is, not unwound: [S, L] then E becomes [S, L, E]', () => {
    const interp = createInterpreter(envWith({ '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, state());
    interp.pushToken(program, 'git');
    interp.pushToken(program, ['E', { type: 'unknown_error', description: 'boom' }]);

    expect(interp.execute(program)).toEqual([
      ['S', { targets: [], focus: [] }],
      ['L', ['git']],
      ['E', { type: 'unknown_error', description: 'boom' }],
    ]);
  });

  it('§6 an E on top seals the stack against trailing literals', () => {
    const interp = createInterpreter(envWith({ '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, state());
    interp.pushToken(program, 'git');
    interp.pushToken(program, ['E', { type: 'unknown_error', description: 'boom' }]);
    interp.pushToken(program, 'trailing');

    expect(interp.execute(program)).toEqual([
      ['S', { targets: [], focus: [] }],
      ['L', ['git']],
      ['E', { type: 'unknown_error', description: 'boom' }],
    ]);
  });

  it('§1 a program whose first item is an unparsable E evaluates to [E]', () => {
    const interp = createInterpreter(envWith({ '.$': identity }));
    const program: Program = [];
    interp.pushToken(program, ['bogus']);
    interp.pushToken(program, 'ignored');

    const result = interp.execute(program);
    expect(result.length).toBe(1);
    expect(result[0]?.[0]).toBe('E');
  });
});
