// Host-neutral hook policy: pure functions over command text and file heads, with no imports, so
// scripts/sync-hook-policy.ts can transpile this file into the plugin's standalone hook library.

export type Verdict = 'allow' | 'ask' | 'block';

export interface Decision {
  readonly reason: string;
  readonly verdict: Verdict;
}

export interface ShellContext {
  /** Current branch of the repository at `directory` (the session cwd when undefined). */
  readonly currentBranch: (directory?: string) => string | undefined;
  /** Text of a file named in the command, relative to the session cwd; undefined when unreadable. */
  readonly readFile?: (file: string) => string | undefined;
}

export const ALLOW: Decision = { reason: '', verdict: 'allow' };

const RANK: Record<Verdict, number> = { allow: 0, ask: 1, block: 2 };

/** The strictest decision wins; the first reason at that level is kept. */
export const strictest = (decisions: readonly Decision[]): Decision => {
  let worst = ALLOW;
  for (const decision of decisions) {
    if (RANK[decision.verdict] > RANK[worst.verdict]) {
      worst = decision;
    }
  }
  return worst;
};

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
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u;

/** Drop leading environment assignments and wrapper commands such as `env` or `sudo`. */
const program = (words: readonly string[]): string[] => {
  let start = 0;
  while (
    start < words.length &&
    (ASSIGNMENT.test(words[start]) || WRAPPERS.has(words[start]) || words[start].startsWith('-'))
  ) {
    start += 1;
  }
  return words.slice(start);
};

const basename = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

/** Git options before the subcommand that take a separate value. */
const GIT_VALUED_OPTIONS = new Set([
  '-C',
  '-c',
  '--config-env',
  '--exec-path',
  '--git-dir',
  '--namespace',
  '--super-prefix',
  '--work-tree',
]);

interface GitCommand {
  readonly args: readonly string[];
  readonly directory?: string;
  readonly subcommand: string;
}

const parseGit = (words: readonly string[]): GitCommand | undefined => {
  if (words.length === 0 || basename(words[0]) !== 'git') {
    return undefined;
  }
  let directory: string | undefined;
  let index = 1;
  while (index < words.length && words[index].startsWith('-')) {
    if (GIT_VALUED_OPTIONS.has(words[index])) {
      if (words[index] === '-C') {
        directory = directory === undefined ? words[index + 1] : `${directory}/${words[index + 1]}`;
      }
      index += 2;
    } else {
      index += 1;
    }
  }
  if (index >= words.length) {
    return undefined;
  }
  return { args: words.slice(index + 1), directory, subcommand: words[index] };
};

/** Short flags in clusters such as `-an`; a flag in `valued` takes the rest of its cluster or the next word. */
const shortFlags = (args: readonly string[], valued: string): Set<string> => {
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

const hasLong = (args: readonly string[], ...names: string[]): boolean =>
  args.some((arg) => names.some((name) => arg === name || arg.startsWith(`${name}=`)));

/** Positional arguments, skipping options and the values of options listed in `valued`. */
const positionals = (args: readonly string[], valued: ReadonlySet<string>): string[] => {
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

export const PROTECTED_BRANCH = /^(?:main|develop|staging|release\/.+)$/u;

const isProtected = (branch: string | undefined): branch is string =>
  branch !== undefined && PROTECTED_BRANCH.test(branch);

const ask = (reason: string): Decision => ({ reason, verdict: 'ask' });
const block = (reason: string): Decision => ({ reason, verdict: 'block' });

const COMMIT_VALUED_SHORT = 'mFCctS';
const PUSH_VALUED = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

const branchName = (ref: string): string => ref.replace(/^refs\/heads\//u, '');

const classifyCommit = (git: GitCommand, context: ShellContext): Decision => {
  if (hasLong(git.args, '--no-verify') || shortFlags(git.args, COMMIT_VALUED_SHORT).has('n')) {
    return block(
      'git commit --no-verify skips repository hooks; let the hooks run and fix what they report',
    );
  }
  const branch = context.currentBranch(git.directory);
  return isProtected(branch)
    ? ask(`git commit on the protected branch ${branch}; create a feature branch first`)
    : ALLOW;
};

const classifyPush = (git: GitCommand, context: ShellContext): Decision => {
  if (hasLong(git.args, '--no-verify')) {
    return block(
      'git push --no-verify skips repository hooks; let the hooks run and fix what they report',
    );
  }
  const [, ...refspecs] = positionals(git.args, PUSH_VALUED);
  const decisions: Decision[] = [];
  if (
    hasLong(git.args, '--force', '--force-with-lease', '--force-if-includes', '--mirror') ||
    shortFlags(git.args, 'o').has('f') ||
    refspecs.some((refspec) => refspec.startsWith('+'))
  ) {
    decisions.push(ask('git push rewrites remote history (force push)'));
  }
  if (hasLong(git.args, '--all', '--branches', '--mirror')) {
    decisions.push(ask('git push of every branch includes protected branches'));
  }
  const targets =
    refspecs.length > 0
      ? refspecs.map((refspec) => branchName(refspec.replace(/^\+/u, '').split(':').at(-1) ?? ''))
      : [context.currentBranch(git.directory)];
  const protectedTarget = targets.find(isProtected);
  if (protectedTarget !== undefined) {
    decisions.push(ask(`git push to the protected branch ${protectedTarget}`));
  }
  return strictest(decisions);
};

const classifyGit = (git: GitCommand, context: ShellContext): Decision => {
  switch (git.subcommand) {
    case 'commit': {
      return classifyCommit(git, context);
    }
    case 'push': {
      return classifyPush(git, context);
    }
    case 'reset': {
      return hasLong(git.args, '--hard')
        ? ask('git reset --hard discards uncommitted and committed work')
        : ALLOW;
    }
    case 'clean': {
      return hasLong(git.args, '--force') || shortFlags(git.args, 'e').has('f')
        ? ask('git clean -f deletes untracked files')
        : ALLOW;
    }
    case 'checkout': {
      return git.args.includes('--') && git.args.indexOf('--') < git.args.length - 1
        ? ask('git checkout -- <path> discards uncommitted changes to those paths')
        : ALLOW;
    }
    case 'restore': {
      const staged = hasLong(git.args, '--staged') || shortFlags(git.args, 's').has('S');
      const worktree = hasLong(git.args, '--worktree') || shortFlags(git.args, 's').has('W');
      return staged && !worktree
        ? ALLOW
        : ask('git restore <path> discards uncommitted changes to those paths');
    }
    case 'stash': {
      return git.args[0] === 'drop' ? ask('git stash drop deletes a stash entry') : ALLOW;
    }
    default: {
      return ALLOW;
    }
  }
};

/** Git safety for one shell command line: blocks hook bypasses, asks before risky history edits. */
export const classifyGitSafety = (command: string, context: ShellContext): Decision =>
  strictest(
    splitCommands(command).map((words) => {
      const git = parseGit(program(words));
      return git === undefined ? ALLOW : classifyGit(git, context);
    }),
  );

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gu;
const NOREPLY = /(?:^no-?reply@|@users\.noreply\.github\.com$)/iu;

/** Email addresses in `text`, excluding noreply addresses such as GitHub's commit emails. */
export const findEmails = (text: string): string[] =>
  [...text.matchAll(EMAIL)].map((match) => match[0]).filter((email) => !NOREPLY.test(email));

/** An email with its local part masked, so a hook message does not repeat the address. */
export const maskEmail = (email: string): string =>
  `${email[0]}***${email.slice(email.indexOf('@'))}`;

const readValue = (value: string, context: ShellContext): string =>
  value === '-' ? '' : (context.readFile?.(value) ?? '');

const optionValues = (
  args: readonly string[],
  inline: ReadonlySet<string>,
  files: ReadonlySet<string>,
  context: ShellContext,
): string[] => {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const equals = arg.indexOf('=');
    const name = arg.startsWith('--') && equals > 0 ? arg.slice(0, equals) : arg;
    const attached = name === arg ? args[index + 1] : arg.slice(equals + 1);
    if (inline.has(name) || files.has(name)) {
      if (attached !== undefined) {
        values.push(files.has(name) ? readValue(attached, context) : attached);
      }
      if (name === arg) {
        index += 1;
      }
    }
  }
  return values;
};

const GH_TEXT = new Set(['--body', '--title', '-b', '-t']);
const GH_FILES = new Set(['--body-file', '-F']);
const GH_API_FIELDS = new Set(['-f', '-F', '--field', '--raw-field']);
const GIT_MESSAGE = new Set(['-m', '--message']);
const GIT_MESSAGE_FILES = new Set(['-F', '--file']);
const GH_WRITES: Record<string, ReadonlySet<string>> = {
  issue: new Set(['comment', 'create', 'edit']),
  pr: new Set(['comment', 'create', 'edit', 'review']),
};

/** Text a command publishes: PR, issue, and API bodies from `gh`, and `git commit` messages. */
export const outgoingText = (command: string, context: ShellContext): string[] =>
  splitCommands(command).flatMap((raw) => {
    const words = program(raw);
    if (words.length > 1 && basename(words[0]) === 'gh') {
      const [, area, action, ...rest] = words;
      if (area === 'api') {
        return optionValues([action, ...rest], GH_API_FIELDS, new Set(), context).map((field) =>
          field.includes('=@')
            ? readValue(field.slice(field.indexOf('=@') + 2), context)
            : field.slice(field.indexOf('=') + 1),
        );
      }
      return GH_WRITES[area]?.has(action) ? optionValues(rest, GH_TEXT, GH_FILES, context) : [];
    }
    const git = parseGit(words);
    return git?.subcommand === 'commit'
      ? optionValues(git.args, GIT_MESSAGE, GIT_MESSAGE_FILES, context)
      : [];
  });

/** Ask before PR, issue, API, or commit text that names a person by email address. */
export const classifyEmailScan = (command: string, context: ShellContext): Decision => {
  const emails = outgoingText(command, context).flatMap(findEmails);
  return emails.length === 0
    ? ALLOW
    : ask(
        `outgoing PR, issue, or commit text contains an email address (${[...new Set(emails)].map(maskEmail).join(', ')}); refer to people by id, count, or hash instead`,
      );
};

const GENERATED_MARKERS = [
  /@generated\b/u,
  /DO NOT EDIT/u,
  /Do not edit directly/iu,
  /\bGenerated (?:by|from)\b/u,
];
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;

/** The marker that shows a file is generated, read from its first five lines after any frontmatter. */
export const generatedMarker = (text: string): string | undefined => {
  const head = text.replace(FRONTMATTER, '').split('\n').slice(0, 5).join('\n');
  return GENERATED_MARKERS.map((marker) => marker.exec(head)?.[0]).find(
    (found) => found !== undefined,
  );
};

const PATH_KEYS = ['file_path', 'filePath', 'path', 'target_file', 'notebook_path', 'filename'];
const PATCH_KEYS = ['command', 'input', 'patch'];
const PATCHED_FILE = /^\*\*\* (?:Update|Delete) File: (?<file>.+)$/gmu;

/** Existing files an edit or write tool call targets, from its path fields or an apply_patch body. */
export const editTargets = (toolInput: unknown): string[] => {
  if (typeof toolInput !== 'object' || toolInput === null) {
    return [];
  }
  const field = (key: string): unknown => Reflect.get(toolInput, key);
  const paths = PATH_KEYS.map(field).filter(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  for (const key of PATCH_KEYS) {
    const value = field(key);
    if (typeof value === 'string') {
      paths.push(
        ...[...value.matchAll(PATCHED_FILE)].map((match) => match.groups?.file.trim() ?? ''),
      );
    }
  }
  return [...new Set(paths)];
};

/** Ask before an edit tool changes a generated file; scripts that regenerate it are unaffected. */
export const classifyGeneratedEdit = (
  files: readonly string[],
  readHead: (file: string) => string | undefined,
): Decision => {
  for (const file of files) {
    const head = readHead(file);
    const marker = head === undefined ? undefined : generatedMarker(head);
    if (marker !== undefined) {
      return ask(`${file} is generated (${marker}); edit its source and regenerate`);
    }
  }
  return ALLOW;
};
