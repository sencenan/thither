import { invariant } from '../lib/invariant';
import { parse } from './parser';
import type { Interpreter, InterpreterEnv, Op, Program, Stack, StackValue } from './types';

const TERM: Op = '.$';

const push = (stack: Stack, value: StackValue): Stack => {
  const top = stack[stack.length - 1];

  if (!top) {
    // empty stack
    stack.push(value);
    return stack;
  }

  const [topSigil, topToken] = top;
  const [sigil, token] = value;

  switch (topSigil) {
    case 'R':
    case 'E':
      // ignore future values if top is already R, E
      return stack;

    default:
      if (topSigil === 'L' && sigil === topSigil) {
        stack[stack.length - 1] = ['L', [...topToken, ...token]];
      } else {
        stack.push(value);
      }

      return stack;
  }
};

export const createInterpreter = (env: InterpreterEnv): Interpreter => {
  const interpreter = {
    pushToken: (program: Program, raw: unknown): Program => {
      program.push(parse(env, raw));
      return program;
    },

    execute: (program: Program): Stack => {
      if (!hasTerminalOp(program)) {
        program = interpreter.pushToken(program, TERM);
      }

      let stack: Stack = [];

      for (const token of program) {
        const [sigil, body] = token;

        switch (sigil) {
          case 'l':
            push(stack, ['L', [body]]);
            break;

          case 'o': {
            const fn = env.symbols.get(body);
            invariant(fn, `operation ${body} not found`);
            stack = fn(stack);
            break;
          }

          case 'S':
          case 'R':
          case 'E':
            push(stack, token);
        }
      }

      return stack;
    },
  };

  return interpreter;
};

const hasTerminalOp = (program: Program): boolean => {
  const last = program[program.length - 1];
  return !!(last && last[0] === 'o' && last[1] === TERM);
};
