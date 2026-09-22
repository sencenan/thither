import { invariant } from '../lib/invariant';
import { parse } from './parser';
import type { Interpreter, InterpreterEnv, Op, Program, Stack, Token } from './types';

const TERM: Op = '.$';
const TERM_TOKEN: Token = ['o', '.$'];

export const createInterpreter = (env: InterpreterEnv): Interpreter => {
  const interpreter = {
    pushToken: (program: Program, raw: unknown): Program => {
      program.push(parse(env, raw));
      return program;
    },

    execute: (program: Program): Stack => {
      if (program.length === 0 || program[program.length - 1] !== TERM_TOKEN) {
        program = interpreter.pushToken(program, TERM);
      }

      let stack: Stack = [];
      let token = program.shift();
      while (token) {
        const [sigil, body] = token;

        switch (sigil) {
          case 'l': {
            const top = stack[stack.length - 1];

            if (top && top[0] === 'L') {
              top[1].push(body);
            } else {
              stack.push(['L', [body]]);
            }

            break;
          }

          case 'o': {
            const fn = env.symbols.get(body);
            invariant(fn, `operation ${body} not found`);
            stack = fn(stack);
            break;
          }

          case 'S':
          case 'R':
          case 'E':
            stack.push(token);
        }

        token = program.shift();
      }

      return stack;
    },
  };

  return interpreter;
};
