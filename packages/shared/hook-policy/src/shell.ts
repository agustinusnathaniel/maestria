// Shared shell parsing: splitting a command line into simple commands, shared
// predicates over words, and exposing substitution and heredoc bodies as
// separate command texts. Imported by the git, env-dump, and email policies.

const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '\n']);

/**
 * Split a shell command into simple commands of unquoted words. Quotes and backslash escapes are
 * resolved; command substitution and redirection are kept as plain words, which errs toward
 * classifying more text as a command rather than less.
 */
export const splitCommands = (command: string): string[][] => {
  const commands: string[][] = [];
  let words: string[] = [];
  let word = '';
  let inWord = false;
  let quote: '"' | "'" | undefined;
  const endWord = (): void => {
    if (inWord) {
      words.push(word);
    }
    word = '';
    inWord = false;
  };
  const endCommand = (): void => {
    endWord();
    if (words.length > 0) {
      commands.push(words);
    }
    words = [];
  };
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else if (char === '\\' && quote === '"' && index + 1 < command.length) {
        index += 1;
        word += command[index];
      } else {
        word += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      inWord = true;
    } else if (char === '\\' && index + 1 < command.length) {
      index += 1;
      if (command[index] !== '\n') {
        word += command[index];
        inWord = true;
      }
    } else if (SEPARATORS.has(command.slice(index, index + 2))) {
      endCommand();
      index += 1;
    } else if (SEPARATORS.has(char)) {
      endCommand();
    } else if (char === ' ' || char === '\t' || char === '\r') {
      endWord();
    } else {
      word += char;
      inWord = true;
    }
  }
  endCommand();
  return commands;
};

const WRAPPERS = new Set(['command', 'env', 'exec', 'nohup', 'sudo', 'time']);
export const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u;

/** Drop leading environment assignments and wrapper commands such as `env` or `sudo`. */
export const program = (words: readonly string[]): string[] => {
  let start = 0;
  while (
    start < words.length &&
    (ASSIGNMENT.test(words[start]) || WRAPPERS.has(words[start]) || words[start].startsWith('-'))
  ) {
    start += 1;
  }
  return words.slice(start);
};

export const basename = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

/** Short flags in clusters such as `-an`; a flag in `valued` takes the rest of its cluster or the next word. */
export const shortFlags = (args: readonly string[], valued: string): Set<string> => {
  const flags = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      break;
    }
    if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
      for (let position = 1; position < arg.length; position += 1) {
        flags.add(arg[position]);
        if (valued.includes(arg[position])) {
          if (position === arg.length - 1) {
            index += 1;
          }
          break;
        }
      }
    }
  }
  return flags;
};

export const hasLong = (args: readonly string[], ...names: string[]): boolean =>
  args.some((arg) => names.some((name) => arg === name || arg.startsWith(`${name}=`)));

/** Positional arguments, skipping options and the values of options listed in `valued`. */
export const positionals = (args: readonly string[], valued: ReadonlySet<string>): string[] => {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      result.push(...args.slice(index + 1));
      break;
    }
    if (arg.startsWith('-')) {
      if (valued.has(arg)) {
        index += 1;
      }
    } else {
      result.push(arg);
    }
  }
  return result;
};

/** Index of the `)` that closes the `(` at `open`, skipping quoted text; the end when unclosed. */
const closingParen = (text: string, open: number): number => {
  let depth = 0;
  let quote: '"' | "'" | undefined;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (quote === "'") {
      if (char === "'") {
        quote = undefined;
      }
    } else if (char === '\\') {
      index += 1;
    } else if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return text.length;
};

/** Index of the backtick that closes the one at `open`; the end when unclosed. */
const closingBacktick = (text: string, open: number): number => {
  for (let index = open + 1; index < text.length; index += 1) {
    if (text[index] === '\\') {
      index += 1;
    } else if (text[index] === '`') {
      return index;
    }
  }
  return text.length;
};

interface Scan {
  /** Command substitutions inside double quotes, which run although they are quoted. */
  readonly nested: string[];
  /** The text with unquoted parentheses and backticks turned into command separators. */
  readonly plain: string;
}

/** Expose subshells, process and command substitutions, and backticks as separate commands. */
const scanSubstitutions = (text: string, inDoubleQuotes = false): Scan => {
  const nested: string[] = [];
  let plain = '';
  let quote: '"' | "'" | undefined = inDoubleQuotes ? '"' : undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote === "'") {
      plain += char;
      if (char === "'") {
        quote = undefined;
      }
    } else if (char === '\\' && index + 1 < text.length) {
      plain += char + text[index + 1];
      index += 1;
    } else if (quote === '"') {
      if (char === '$' && text[index + 1] === '(') {
        const close = closingParen(text, index + 1);
        nested.push(text.slice(index + 2, close));
        index = close;
      } else if (char === '`') {
        const close = closingBacktick(text, index);
        nested.push(text.slice(index + 1, close));
        index = close;
      } else {
        plain += char;
        if (char === '"') {
          quote = undefined;
        }
      }
    } else if (char === '"' || char === "'") {
      plain += char;
      quote = char;
    } else {
      plain += char === '(' || char === ')' || char === '`' ? ';' : char;
    }
  }
  return { nested, plain };
};

const HEREDOC = /(?<!<)<<(?<dash>-?)[ \t]*(?<quote>\\|['"]?)(?<word>[A-Za-z_][\w.-]*)['"]?/gu;

interface Heredocs {
  /** Bodies with an unquoted delimiter, whose command substitutions still run. */
  readonly expanded: string[];
  readonly text: string;
}

/** Remove heredoc bodies, which are data, keeping the lines that start them. */
const stripHeredocs = (command: string): Heredocs => {
  const lines = command.split('\n');
  const kept: string[] = [];
  const expanded: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    kept.push(lines[index]);
    for (const match of lines[index].matchAll(HEREDOC)) {
      const { dash = '', quote = '', word = '' } = match.groups ?? {};
      const end = lines.findIndex(
        (line, position) =>
          position > index && (dash === '' ? line : line.replace(/^\t+/u, '')) === word,
      );
      if (end !== -1) {
        if (quote === '') {
          expanded.push(lines.slice(index + 1, end).join('\n'));
        }
        index = end;
      }
    }
  }
  return { expanded, text: kept.join('\n') };
};

/** Every command text the shell would run: the line itself, then each substitution body. */
export const commandTexts = (command: string): string[] => {
  const { expanded, text } = stripHeredocs(command);
  const { nested, plain } = scanSubstitutions(text);
  const bodies = [...nested, ...expanded.flatMap((body) => scanSubstitutions(body, true).nested)];
  return [plain, ...bodies.flatMap(commandTexts)];
};
