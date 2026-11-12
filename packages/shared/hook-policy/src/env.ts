import type { Decision } from './types.js';
import { ALLOW, ask } from './types.js';
import { ASSIGNMENT, basename, commandTexts, hasLong, shortFlags, splitCommands } from './shell.js';

const SHELL_KEYWORDS = new Set([
  '!',
  '{',
  '}',
  'do',
  'elif',
  'else',
  'if',
  'then',
  'until',
  'while',
]);
const PREFIX_COMMANDS = new Set(['builtin', 'command', 'exec', 'nohup', 'time']);
const ELEVATORS = new Set(['doas', 'sudo']);
const SUDO_VALUED = new Set(['-C', '-D', '-g', '-h', '-p', '-R', '-r', '-T', '-t', '-U', '-u']);
const REDIRECTION = /^(?:\d+|&)?(?:<<<|<<-?|>>|>\||<>|>&|<&|>|<)/u;
const PROC_ENVIRON =
  /^<?\/proc\/(?:self|thread-self|\d+|\$\$|\$\{?[A-Za-z_]\w*\}?)\/(?:task\/\d+\/)?environ$/u;
/** Prefixes such as dd's `if=` that attach a file path to a single word. */
const ATTACHED_PATH = /^[A-Za-z_][A-Za-z0-9_-]*=/u;

/** Commands that name a file without printing its contents. */
const NOT_READING = new Set(['[', 'echo', 'ls', 'printf', 'stat', 'test']);

/** Words of a simple command without redirections and a trailing comment. */
const commandWords = (words: readonly string[]): string[] => {
  const result: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word.startsWith('#')) {
      break;
    }
    // A redirection attached to a word, as in `env>out.txt`, ends that word.
    const attached = /^(?<head>[^<>]*[^<>\d&])[<>]/u.exec(word)?.groups?.head;
    const redirect = REDIRECTION.exec(word);
    if (attached !== undefined) {
      result.push(attached);
    } else if (redirect === null) {
      result.push(word);
    } else if (redirect[0] === word) {
      index += 1;
    }
  }
  return result;
};

/** Drop keywords, assignments, and wrappers that run the next word, such as `sudo` or `exec`. */
const unwrap = (words: readonly string[], start = 0): number => {
  let index = start;
  while (index < words.length) {
    const word = words[index];
    if (SHELL_KEYWORDS.has(word) || ASSIGNMENT.test(word)) {
      index += 1;
    } else if (ELEVATORS.has(basename(word)) || PREFIX_COMMANDS.has(word)) {
      if (word === 'command' && ['-v', '-V'].includes(words[index + 1])) {
        return words.length;
      }
      index += 1;
      while (index < words.length && words[index].startsWith('-') && words[index] !== '--') {
        index += SUDO_VALUED.has(words[index]) || words[index] === '-a' ? 2 : 1;
      }
      if (words[index] === '--') {
        index += 1;
      }
    } else {
      break;
    }
  }
  return index;
};

const ENV_VALUED = new Set(['-C', '-u', '--chdir', '--unset']);

/**
 * The command `env` runs after its options and assignments, or `'dump'` when it runs none and
 * prints the inherited environment. `-i` starts from an empty environment, and `-S` runs a command.
 */
const envCommand = (args: readonly string[], start: number): number | 'dump' | undefined => {
  let empty = false;
  let index = start;
  let options = true;
  while (index < args.length) {
    const arg = args[index];
    if (options && arg === '--') {
      options = false;
      index += 1;
    } else if (options && arg.startsWith('-')) {
      if (['--help', '--version'].includes(arg) || arg.startsWith('--split-string')) {
        return undefined;
      }
      const short = arg.startsWith('--') ? '' : arg.slice(1);
      const valueAt = short.search(/[CuS]/u);
      const flags = valueAt === -1 ? short : short.slice(0, valueAt + 1);
      if (arg === '-' || arg === '--ignore-environment' || flags.includes('i')) {
        empty = true;
      }
      if (flags.includes('S')) {
        return undefined;
      }
      index += ENV_VALUED.has(arg) || (valueAt !== -1 && valueAt === short.length - 1) ? 2 : 1;
    } else if (ASSIGNMENT.test(arg)) {
      index += 1;
    } else {
      return index;
    }
  }
  return empty ? undefined : 'dump';
};

/** What a simple command dumps from the environment, or undefined when it reads none of it. */
const environmentDump = (raw: readonly string[]): string | undefined => {
  const words = commandWords(raw);
  let start = unwrap(words);
  if (start >= words.length) {
    return undefined;
  }
  if (!NOT_READING.has(basename(words[start]))) {
    const proc = raw.find((word) => PROC_ENVIRON.test(word.replace(ATTACHED_PATH, '')));
    if (proc !== undefined) {
      return `reading ${proc.replace(/^</u, '')}`;
    }
  }
  while (basename(words[start]) === 'env') {
    const next = envCommand(words, start + 1);
    if (next === 'dump') {
      return 'env without a command';
    }
    start = next === undefined ? words.length : unwrap(words, next);
    if (start >= words.length) {
      return undefined;
    }
  }
  const head = basename(words[start]);
  const args = words.slice(start + 1);
  const options = args.filter((arg) => arg.startsWith('-'));
  const names = args.filter((arg) => !arg.startsWith('-'));
  switch (head) {
    case 'printenv': {
      return names.length === 0 && !hasLong(options, '--help', '--version')
        ? 'printenv without a variable name'
        : undefined;
    }
    case 'set': {
      return args.length === 0 ? 'set without arguments' : undefined;
    }
    case 'export': {
      return args.every((arg) => arg === '-p') ? ['export', ...args].join(' ') : undefined;
    }
    case 'declare':
    case 'typeset': {
      const flags = shortFlags(options, '');
      return names.length === 0 && (flags.has('x') || flags.has('p'))
        ? `${head} ${options.join(' ')} without names`
        : undefined;
    }
    default: {
      return undefined;
    }
  }
};

/**
 * Ask before a shell command prints the whole environment, which puts every secret in it into the
 * transcript: `env` or `printenv` alone, a bare `set`, `export -p`, `declare -x`/`-p` without
 * names, or reading `/proc/<pid>/environ`, anywhere in a pipeline, list, subshell, or substitution.
 */
export const classifyEnvDump = (command: string): Decision => {
  for (const text of commandTexts(command)) {
    for (const words of splitCommands(text)) {
      const dump = environmentDump(words);
      if (dump !== undefined) {
        return ask(
          `${dump} prints the whole environment, secrets included, into the transcript; read the one variable by name (printenv NAME), and for a secret check presence only ([ -n "$NAME" ] && echo set)`,
        );
      }
    }
  }
  return ALLOW;
};
