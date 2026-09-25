import { expect } from 'vitest';
import { defaultEnv } from '../../env.ts';
import { createInterpreter } from '../../interpreter.ts';
import type { OpFn, Program, Stack, State, Template } from '../../types.ts';
import { arityOf, keyOf } from '../../utils.ts';

// A ready interpreter for tests that call an operation directly (bypassing the harness) to
// observe its operand contract; the operation ignores it, but OpFn takes it as its first arg.
export const testInterp = createInterpreter(defaultEnv());

// Runs a program with the operations under test bound. The interpreter appends
// nothing (ADR 0007), so the final stack shows exactly what the operations left behind.
export const runWith =
  (ops: Readonly<Record<string, OpFn>>) =>
  (items: readonly unknown[]): Stack => {
    const interp = createInterpreter({
      symbols: new Map<string, OpFn>(Object.entries(ops)),
    });
    const program: Program = [];
    for (const item of items) {
      interp.pushToken(program, item);
    }
    return interp.execute(program);
  };

// A target written in a test: its dimensions and one or more variants. `state` normalizes the
// dimensions into a key and sorts the variants by arity, exactly as the parser and operations do,
// so an expected state built the same way compares equal to the one the code produces.
export type TargetSpec = readonly [dims: readonly string[], ...variants: Template[]];

export const state = (specs: readonly TargetSpec[], focus: readonly string[] = []): State => {
  const targets: Record<string, readonly Template[]> = {};
  for (const [dims, ...variants] of specs) {
    targets[keyOf(dims)] = [...variants].sort((a, b) => arityOf(a) - arityOf(b));
  }
  return ['S', { targets, focus }];
};

export const error = (type: string) => ['E', expect.objectContaining({ type })];

export const companyGit: TargetSpec = [['company', 'git'], 'https://github.com/company/{}'];
export const companyDocs: TargetSpec = [['company', 'docs'], 'https://docs.company.com/{}'];
export const personalGit: TargetSpec = [['git', 'personal'], 'https://github.com/me/{}'];
export const three = [companyGit, companyDocs, personalGit];
export const explicitError = ['E', { type: 'unknown_error', description: 'boom' }];

export type Case = readonly [name: string, program: readonly unknown[], stack: readonly unknown[]];
