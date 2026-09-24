import { invariant } from '../lib/invariant.ts';
import { parse } from './parser.ts';
import type { Interpreter, InterpreterEnv, Program, Stack } from './types.ts';
import { push } from './utils.ts';

export const createInterpreter = (env: InterpreterEnv): Interpreter => {
  const interpreter = {
    pushToken: (program: Program, raw: unknown): Program => {
      program.push(parse(env, raw));
      return program;
    },

    execute: (program: Program, initial: Stack = []): Stack => {
      // The stack is the caller's: copy it so evaluation never mutates it (ADR 0006).
      // The program is evaluated exactly as given — the interpreter appends nothing (ADR 0007).
      let stack: Stack = [...initial];

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
