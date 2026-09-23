import { expect } from 'vitest';
import { createInterpreter } from '../../interpreter.ts';
import type { OpFn, Program, Stack, State, Target } from '../../types.ts';

const identity: OpFn = (stack) => stack;

// Runs a program with the operations under test bound, plus a no-op terminal `.$`
// so the final stack shows exactly what the operations left behind.
export const runWith =
  (ops: Readonly<Record<string, OpFn>>) =>
  (items: readonly unknown[]): Stack => {
    const interp = createInterpreter({
      symbols: new Map<string, OpFn>([...Object.entries(ops), ['.$', identity]]),
    });
    const program: Program = [];
    for (const item of items) {
      interp.pushToken(program, item);
    }
    return interp.execute(program);
  };

export const state = (targets: readonly Target[], focus: readonly string[] = []): State => [
  'S',
  { targets: [...targets], focus },
];

export const error = (type: string) => ['E', expect.objectContaining({ type })];

export const companyGit: Target = [['company', 'git'], 'https://github.com/company/{}'];
export const companyDocs: Target = [['company', 'docs'], 'https://docs.company.com/{}'];
export const personalGit: Target = [['git', 'personal'], 'https://github.com/me/{}'];
export const three = [companyGit, companyDocs, personalGit];
export const explicitError = ['E', { type: 'unknown_error', description: 'boom' }];

export type Case = readonly [name: string, program: readonly unknown[], stack: readonly unknown[]];
