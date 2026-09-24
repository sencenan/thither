import { at } from './operations/at.ts';
import { rm } from './operations/rm.ts';
import { search } from './operations/search.ts';
import { set } from './operations/set.ts';
import { type InterpreterEnv, type Op, type OpFn, TERM_OP } from './types.ts';

export const defaultEnv = (): InterpreterEnv => ({
  symbols: new Map<Op, OpFn>([
    ['.set', set],
    ['.rm', rm],
    ['.@', at],
    [TERM_OP, search],
  ]),
});
