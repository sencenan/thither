// Thither REPL — a developer tool for poking at the language core from a terminal.
// Not a client: it holds one in-memory stack and mimics the browser client's loop
// (browser-client.md "Execution flow") — build a program from whitespace-split
// tokens, execute on the current stack, pop the terminal R/E, keep the rest.
//
//   pnpm repl
//   > https://github.com/company/{} company git .set
//   > comp git thither
//   > :help

import { createInterface } from 'node:readline';
import {
  createInterpreter,
  defaultEnv,
  emptyState,
  type Match,
  type Stack,
  type StackValue,
  type Target,
} from '../src/dsl/index.ts';

const interp = createInterpreter(defaultEnv());

let stack: Stack = [emptyState()];
const history: Stack[] = [];

// ANSI helpers (plain when not a TTY)
const tty = process.stdout.isTTY;
const paint = (code: string) => (text: string) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = paint('2');
const bold = paint('1');
const green = paint('32');
const red = paint('31');
const yellow = paint('33');
const cyan = paint('36');
const underline = paint('4;1');

const seed: readonly Target[] = [
  [['company', 'git'], 'https://github.com/company/{}'],
  [['company', 'docs'], 'https://docs.company.com/{}'],
  [['git', 'personal'], 'https://github.com/me/{}'],
  [['personal', 'git', 'pr'], 'https://github.com/me/{}/pull/{}'],
  [['docs'], 'https://docs.example.com/'],
];

const help = `
${bold('tokens')}      anything else is a program: split on whitespace, executed on the current stack
${bold(':state')}      show the current state of the world (targets + focus)
${bold(':stack')}      show the whole persisted stack as JSON
${bold(':seed')}       replace the state with a sample target set
${bold(':reset')}      back to [emptyState()]
${bold(':undo')}       restore the previous persisted stack
${bold(':load <json>')} replace the stack with a JSON stack array (validated through pushToken)
${bold(':help')}       this
${bold(':q')}          quit
`;

const showState = (value: StackValue | undefined): string => {
  if (value?.[0] !== 'S') {
    return dim(`(top of stack is ${value?.[0] ?? 'nothing'}, not S)`);
  }
  const { targets, focus } = value[1];
  const lines = targets.map(
    ([dims, dest], i) =>
      `  ${dim(String(i + 1).padStart(2))}  ${cyan(dims.join(' ').padEnd(28))} ${dest}`,
  );
  return [
    `${bold('focus')}: ${focus.length ? cyan(focus.join(' ')) : dim('(none)')}`,
    `${bold('targets')}: ${targets.length ? '' : dim('(none)')}`,
    ...lines,
  ].join('\n');
};

// Highlight the matched positions inside the target's searchable string (dsl.md §5 evidence).
const evidence = (dims: readonly string[], positions: readonly number[]): string => {
  const text = dims.join(' ');
  const hit = new Set(positions);
  return [...text].map((ch, i) => (hit.has(i) ? underline(ch) : dim(ch))).join('');
};

const showMatch = (match: Match, i: number, unique: boolean): string => {
  const [dest, dims, args, hint] = match;
  const complete = hint.argDelta >= 0;
  const marker = complete ? green('●') : yellow('○');
  const nav = unique && complete ? green('  ← navigate') : '';
  const balance =
    hint.argDelta === 0 ? '' : dim(` argDelta ${hint.argDelta > 0 ? '+' : ''}${hint.argDelta}`);
  return [
    `  ${dim(String(i + 1))} ${marker} ${complete ? dest : yellow(dest)}${nav}`,
    `      ${evidence(dims, hint.positions)}${dim(`  score ${hint.score}`)}${balance}${
      args.length ? dim(`  args ${JSON.stringify(args)}`) : ''
    }`,
  ].join('\n');
};

const showTop = (top: StackValue | undefined): void => {
  if (top?.[0] === 'R') {
    const { matches, inputs } = top[1];
    console.log(dim(`inputs ${JSON.stringify(inputs)}`));
    if (matches.length === 0) {
      console.log(yellow('  no matches'));
    }
    for (const [i, m] of matches.entries()) {
      console.log(showMatch(m, i, matches.length === 1));
    }
    if (matches.length > 1) {
      console.log(dim(`  ${matches.length} matches → fallback page`));
    }
  } else if (top?.[0] === 'E') {
    console.log(`${red('E')} ${bold(top[1].type)}: ${top[1].description}`);
  } else {
    console.log(dim(`top of stack: ${JSON.stringify(top)}`));
  }
};

// The REPL is a host (ADR 0007): it composes the terminal `.$` onto every line itself, since
// the core evaluates exactly the program it is given. An empty line composes just `['.$']`,
// which searches on focus alone. The composed program is echoed dim so the epilogue is visible.
const execute = (tokens: readonly string[]): void => {
  const composed = [...tokens, '.$'];
  console.log(dim(`> ${composed.join(' ')}`));
  const program = composed.reduce(interp.pushToken, []);
  const result = interp.execute(program, stack);
  const top = result[result.length - 1];
  const remaining = top && (top[0] === 'R' || top[0] === 'E') ? result.slice(0, -1) : result;

  // The mutation's effect first: it happened before the search below.
  if (JSON.stringify(remaining) !== JSON.stringify(stack)) {
    history.push(stack);
    stack = remaining;
    console.log(dim('state changed'));
  }

  showTop(top);
};

const load = (json: string): void => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    console.log(red(`not JSON: ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  if (!Array.isArray(raw)) {
    console.log(red('expected a JSON stack array, e.g. [["S", {"targets": [], "focus": []}]]'));
    return;
  }
  // Validate each value through the core, as the client's reset editor does.
  const program = raw.reduce(interp.pushToken, []);
  const bad = program.find((t) => t[0] === 'E');
  if (bad) {
    console.log(`${red('refused')} ${bold(bad[1].type)}: ${bad[1].description}`);
    return;
  }
  // A persisted stack holds only S/R/E envelopes (browser-client.md "Persistence"); a string
  // token in the array is not a stack value even though it parses.
  const values: StackValue[] = [];
  for (const token of program) {
    if (token[0] === 'S' || token[0] === 'R' || token[0] === 'E') {
      values.push(token);
    } else {
      console.log(
        red(`refused: ${JSON.stringify(token[1])} is a program token, not a stack value`),
      );
      return;
    }
  }
  history.push(stack);
  stack = values;
  console.log(showState(stack[stack.length - 1]));
};

const command = (line: string): boolean => {
  const [cmd, ...rest] = line.split(/\s+/);
  switch (cmd) {
    case ':q':
    case ':quit':
      return false;
    case ':help':
      console.log(help);
      break;
    case ':state':
      console.log(showState(stack[stack.length - 1]));
      break;
    case ':stack':
      console.log(JSON.stringify(stack, null, 2));
      break;
    case ':seed':
      history.push(stack);
      stack = [['S', { targets: [...seed], focus: [] }]];
      console.log(showState(stack[0]));
      break;
    case ':reset':
      history.push(stack);
      stack = [emptyState()];
      console.log(showState(stack[0]));
      break;
    case ':undo': {
      const previous = history.pop();
      if (previous) {
        stack = previous;
        console.log(showState(stack[stack.length - 1]));
      } else {
        console.log(dim('nothing to undo'));
      }
      break;
    }
    case ':load':
      load(rest.join(' '));
      break;
    default:
      console.log(red(`unknown command ${cmd}`), dim('— :help'));
  }
  return true;
};

console.log(
  `${bold('thither')} core REPL ${dim('— :help for commands, :seed for sample targets')}`,
);
console.log(showState(stack[0]));

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${bold('>')} `,
});
rl.prompt();
rl.on('line', (raw) => {
  const line = raw.trim();
  if (line.length === 0) {
    // empty line: the composed program is just `['.$']`, which searches on focus alone
    execute([]);
  } else if (line.startsWith(':')) {
    if (!command(line)) {
      rl.close();
      return;
    }
  } else {
    execute(line.split(/\s+/));
  }
  rl.prompt();
});
rl.on('close', () => {
  console.log();
  process.exit(0);
});
