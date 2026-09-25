const optionSet = (values: string): ReadonlySet<string> => new Set(values.trim().split(/\s+/u));

const SAFE_OPTIONS = {
  branch: optionSet(`
    --all --color --column --contains --list --merged --no-color --no-column
    --no-contains --no-merged --remotes --show-current --sort --verbose -a -r -v -vv
  `),
  cat: optionSet('--number --number-nonblank --show-ends --squeeze-blank'),
  diff: optionSet(`
    --abbrev --color --compact-summary --exit-code --ignore-all-space --ignore-blank-lines
    --ignore-case --ignore-space-change --name-only --name-status --no-color --no-ext-diff
    --no-patch --no-prefix --no-textconv --numstat --quiet --raw --shortstat --stat --summary
    --word-diff
  `),
  grep: optionSet(`
    --after-context --before-context --color --colour --context --count --files-with-matches
    --files-without-match --fixed-strings --invert-match --line-number --no-messages
    --only-matching --quiet --recursive --regexp --text --word-regexp
  `),
  grepShort: optionSet('E F H L P c e f h i l n o p q r s v w x'),
  headTail: optionSet('--bytes --lines --quiet --verbose --zero-terminated'),
  log: optionSet(`
    --abbrev-commit --all --author --branches --date --decorate --dirstat --first-parent
    --grep --max-count --merges --name-only --name-status --no-decorate --no-merges
    --no-ext-diff --no-patch --no-textconv --no-walk --numstat --oneline --patch --patch-with-raw
    --patch-with-stat --raw --reverse --shortstat --skip --stat --summary --tags
    --since --until --walk-reflogs -n -p -u
  `),
  ls: optionSet(`
    --almost-all --all --color --directory --group-directories-first --human-readable
    --inode --long --no-color --null --reverse --size --time-style
  `),
  lsShort: optionSet('A C F R S a b c d f g h i l n o p r s t u w x'),
  pwd: optionSet('--logical --physical'),
  rg: optionSet(`
    --after-context --before-context --case-sensitive --context --count --files
    --files-with-matches --fixed-strings --follow --glob --hidden --ignore-case --ignore-file
    --invert-match --line-number --max-count --max-depth --multiline --no-heading
    --no-ignore --null --only-matching --quiet --regexp --sort --stats --text --type
    --type-add --type-not --unrestricted --word-regexp
  `),
  show: optionSet(`
    --abbrev-commit --date --decorate --dirstat --expand-tabs --name-only --name-status
    --no-color --no-decorate --no-ext-diff --no-patch --no-textconv --numstat --oneline --patch
    --raw --shortstat --stat --summary
  `),
  status: optionSet(`
    --branch --column --ignored --ignore-submodules --long --no-column --null --porcelain
    --short --show-stash --untracked-files --verbose
  `),
} as const;

const SAFE_GREP_OPTIONS = new Set([
  ...SAFE_OPTIONS.grep,
  ...[...SAFE_OPTIONS.grepShort].map((flag) => `-${flag}`),
]);

type LexToken =
  | { kind: 'argument'; value: string }
  | { kind: 'pipe' }
  | { kind: 'stderr-to-stdout' };

interface QuotedValue {
  end: number;
  value: string;
}

const scanQuotedValue = (command: string, start: number, quote: "'" | '"'): QuotedValue | null => {
  let value = '';
  for (let index = start + 1; index < command.length; index += 1) {
    const char = command[index];
    if (char === quote) {
      return { end: index, value };
    }
    if (
      quote === '"' &&
      char === '\\' &&
      ['\\', '"', '$', '`'].includes(command[index + 1] ?? '')
    ) {
      value += command[index + 1] ?? '';
      index += 1;
      continue;
    }
    value += char;
  }
  return null;
};

const lexCommand = (command: string): LexToken[] | null => {
  const tokens: LexToken[] = [];
  let current = '';
  let hasCurrent = false;

  const pushCurrent = (): void => {
    if (hasCurrent) {
      tokens.push({ kind: 'argument', value: current });
      current = '';
      hasCurrent = false;
    }
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === "'" || char === '"') {
      const quoted = scanQuotedValue(command, index, char);
      if (quoted === null) {
        return null;
      }
      current += quoted.value;
      hasCurrent = true;
      index = quoted.end;
      continue;
    }
    if (char === ' ') {
      pushCurrent();
      continue;
    }
    if (char === '|') {
      pushCurrent();
      tokens.push({ kind: 'pipe' });
      continue;
    }
    if (
      !hasCurrent &&
      command.startsWith('2>&1', index) &&
      (index + 4 === command.length || command[index + 4] === ' ')
    ) {
      tokens.push({ kind: 'stderr-to-stdout' });
      index += 3;
      continue;
    }
    if (char === '\\') {
      if (index + 1 >= command.length) {
        return null;
      }
      index += 1;
      current += command[index];
      hasCurrent = true;
      continue;
    }
    if ([';', '&', '<', '>'].includes(char)) {
      return null;
    }
    current += char;
    hasCurrent = true;
  }

  pushCurrent();
  return tokens;
};

const splitPipeline = (tokens: LexToken[]): string[][] | null => {
  const redirectIndex = tokens.findIndex((token) => token.kind === 'stderr-to-stdout');
  if (redirectIndex !== -1) {
    if (redirectIndex !== tokens.length - 1) {
      return null;
    }
    tokens.pop();
  }

  const segments: string[][] = [];
  let current: string[] = [];
  for (const token of tokens) {
    if (token.kind === 'pipe') {
      if (current.length === 0) {
        return null;
      }
      segments.push(current);
      current = [];
    } else if (token.kind === 'argument') {
      current.push(token.value);
    }
  }
  if (current.length === 0) {
    return null;
  }
  segments.push(current);
  return segments;
};

const optionName = (argument: string): string => argument.split('=', 1)[0] ?? argument;

const hasSafeOptions = (
  args: readonly string[],
  allowed: ReadonlySet<string>,
  valueOptions: ReadonlySet<string> = new Set(),
): boolean => {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    if (argument === '--') {
      return true;
    }
    if (!argument.startsWith('-') || argument === '-') {
      continue;
    }
    const name = optionName(argument);
    if (!allowed.has(name)) {
      return false;
    }
    if (valueOptions.has(name) && !argument.includes('=')) {
      if (index + 1 >= args.length) {
        return false;
      }
      index += 1;
    }
  }
  return true;
};

const hasOnlySafeFlags = (value: string, allowed: ReadonlySet<string>): boolean => {
  for (const flag of value) {
    if (!allowed.has(flag)) {
      return false;
    }
  }
  return true;
};

const hasSafeLsOptions = (args: readonly string[]): boolean => {
  for (const argument of args) {
    if (argument === '--') {
      return true;
    }
    if (argument.startsWith('--')) {
      if (!SAFE_OPTIONS.ls.has(optionName(argument))) {
        return false;
      }
    } else if (
      argument.startsWith('-') &&
      argument !== '-' &&
      !hasOnlySafeFlags(argument.slice(1), SAFE_OPTIONS.lsShort)
    ) {
      return false;
    }
  }
  return true;
};

const hasSafeCountOptions = (args: readonly string[]): boolean => {
  const filtered = args.filter(
    (argument) => !/^-\d+$/u.test(argument) && !/^-(?:n|c)\d+$/u.test(argument),
  );
  return hasSafeOptions(filtered, SAFE_OPTIONS.headTail, new Set(['--bytes', '--lines']));
};

const hasSafeGrepOptions = (args: readonly string[]): boolean => {
  const hasSafeShortFlags = args.every((argument) => {
    if (!argument.startsWith('-') || argument === '-' || argument.startsWith('--')) {
      return true;
    }
    return hasOnlySafeFlags(argument.slice(1), SAFE_OPTIONS.grepShort);
  });
  return (
    hasSafeShortFlags &&
    hasSafeOptions(
      args,
      SAFE_GREP_OPTIONS,
      new Set([
        '--after-context',
        '--before-context',
        '--context',
        '--exclude',
        '--exclude-from',
        '--file',
        '--include',
        '--max-count',
        '--regexp',
        '-e',
        '-f',
      ]),
    )
  );
};

const hasSafeBranchArguments = (args: readonly string[]): boolean => {
  const valueOptions = new Set([
    '--contains',
    '--merged',
    '--no-contains',
    '--no-merged',
    '--sort',
  ]);
  const hasList = args.some((argument) => argument === '--list' || argument.startsWith('--list='));
  let hasPosition = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? '';
    if (argument === '--') {
      hasPosition = true;
    } else if (argument.startsWith('-') && argument !== '-') {
      if (valueOptions.has(optionName(argument)) && !argument.includes('=')) {
        index += 1;
      }
    } else {
      hasPosition = true;
    }
  }
  return hasSafeOptions(args, SAFE_OPTIONS.branch, valueOptions) && (!hasPosition || hasList);
};

const REQUIRED_GIT_GLOBAL_ARGS = [
  '--no-pager',
  '--no-optional-locks',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'log.showSignature=false',
  '-c',
  'format.pretty=medium',
] as const;

const stripRequiredGitGlobals = (args: readonly string[]): readonly string[] | null => {
  if (REQUIRED_GIT_GLOBAL_ARGS.some((expected, index) => args[index] !== expected)) {
    return null;
  }
  return args.slice(REQUIRED_GIT_GLOBAL_ARGS.length);
};

const hasRequiredPatchGuards = (args: readonly string[]): boolean =>
  args[0] === '--no-ext-diff' && args[1] === '--no-textconv';

const isReadOnlyGitSegment = (args: readonly string[]): boolean => {
  const normalizedArgs = stripRequiredGitGlobals(args);
  if (normalizedArgs === null) {
    return false;
  }
  const [subcommand, ...gitArgs] = normalizedArgs;
  if (gitArgs.some((argument) => /%G[?GSFKP]|%\(signature:/iu.test(argument))) {
    return false;
  }
  if (subcommand === 'status') {
    return hasSafeOptions(gitArgs, SAFE_OPTIONS.status);
  }
  if (subcommand === 'diff') {
    return hasRequiredPatchGuards(gitArgs) && hasSafeOptions(gitArgs, SAFE_OPTIONS.diff);
  }
  if (subcommand === 'log') {
    if (!hasRequiredPatchGuards(gitArgs)) {
      return false;
    }
    const filtered = gitArgs.filter((argument) => !/^-\d+$/u.test(argument));
    return hasSafeOptions(
      filtered,
      SAFE_OPTIONS.log,
      new Set([
        '--author',
        '--date',
        '--grep',
        '--max-count',
        '--skip',
        '--since',
        '--until',
        '-n',
      ]),
    );
  }
  if (subcommand === 'show') {
    return hasRequiredPatchGuards(gitArgs) && hasSafeOptions(gitArgs, SAFE_OPTIONS.show);
  }
  if (subcommand === 'branch') {
    return hasSafeBranchArguments(gitArgs);
  }
  return false;
};

const isReadOnlySegment = (args: readonly string[]): boolean => {
  const [command, ...commandArgs] = args;
  switch (command) {
    case 'ls': {
      return hasSafeLsOptions(commandArgs);
    }
    case 'cat': {
      return hasSafeOptions(commandArgs, SAFE_OPTIONS.cat);
    }
    case 'head':
    case 'tail': {
      return hasSafeCountOptions(commandArgs);
    }
    case 'grep': {
      return hasSafeGrepOptions(commandArgs);
    }
    case 'rg': {
      return hasSafeOptions(
        commandArgs,
        SAFE_OPTIONS.rg,
        new Set([
          '--after-context',
          '--before-context',
          '--context',
          '--glob',
          '--ignore-file',
          '--max-count',
          '--max-depth',
          '--regexp',
          '--type',
          '--type-add',
        ]),
      );
    }
    case 'pwd': {
      return hasSafeOptions(commandArgs, SAFE_OPTIONS.pwd);
    }
    case 'which': {
      return hasSafeOptions(commandArgs, new Set(['--all', '-a']));
    }
    case 'git': {
      return isReadOnlyGitSegment(commandArgs);
    }
    default: {
      return false;
    }
  }
};

const hasControlCharacters = (value: string): boolean => {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127) {
      return true;
    }
  }
  return false;
};

export const isReadOnlyBashCommand = (rawCommand: string): boolean => {
  const command = rawCommand.trim();
  if (
    command === '' ||
    hasControlCharacters(command) ||
    command.includes('$(') ||
    command.includes('`') ||
    command.includes('<(') ||
    command.includes('>(')
  ) {
    return false;
  }
  const tokens = lexCommand(command);
  if (tokens === null) {
    return false;
  }
  const segments = splitPipeline(tokens);
  return segments?.every(isReadOnlySegment) === true;
};
