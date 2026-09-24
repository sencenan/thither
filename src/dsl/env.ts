import { at } from './operations/at';
import { rm } from './operations/rm';
import { search } from './operations/search';
import { set } from './operations/set';
import { type InterpreterEnv, type Op, type OpFn, TERM_OP } from './types';

export const defaultEnv = (): InterpreterEnv => ({
  symbols: new Map<Op, OpFn>([
    ['.set', set],
    ['.rm', rm],
    ['.@', at],
    [TERM_OP, search],
  ]),
});
