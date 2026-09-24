import { at } from './operations/at.ts';
import { rm } from './operations/rm.ts';
import { search } from './operations/search.ts';
import { set } from './operations/set.ts';
import type { InterpreterEnv, Op, OpFn } from './types.ts';

export const defaultEnv = (): InterpreterEnv => ({
  symbols: new Map<Op, OpFn>([
    ['.set', set],
    ['.rm', rm],
    ['.@', at],
    ['.$', search],
  ]),
});
