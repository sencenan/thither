import { invariant } from '../lib/invariant';
import { parse } from './parser';
import { type Interpreter, type InterpreterEnv, type Program, type Stack, TERM_OP } from './types';
import { push } from './utils';

export const createInterpreter = (env: InterpreterEnv): Interpreter => {
  const interpreter = {
    pushToken: (program: Program, raw: unknown): Program => {
      program.push(parse(env, raw));
      return program;
    },

    execute: (program: Program): Stack => {
      if (!hasTerminalOp(program)) {
        program = interpreter.pushToken(program, TERM_OP);
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
  return !!(last && last[0] === 'o' && last[1] === TERM_OP);
};
