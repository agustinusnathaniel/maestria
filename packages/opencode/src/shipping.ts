/**
 * The small command language exposed after a landing review.
 *
 * This is intentionally not a shell parser. It accepts shell quoting for
 * ordinary arguments, but rejects every operator and expansion. The command
 * is still executed by OpenCode's bash tool, so both checks are required.
 */

export function tokenizeShippingCommand(command: unknown): string[] | undefined {
  if (
    typeof command !== 'string' ||
    command.length === 0 ||
    command.includes('\0') ||
    /[\r\n;&|`$<>]/.test(command)
  ) {
    return undefined;
  }

  const tokens: string[] = [];
  let token = '';
  let quote: 'single' | 'double' | undefined;
  let tokenStarted = false;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];

    if (quote === 'single') {
      if (character === "'") quote = undefined;
      else token += character;
      tokenStarted = true;
      continue;
    }

    if (quote === 'double') {
      if (character === '"') quote = undefined;
      else if (character === '\\') {
        index += 1;
        if (index >= command.length) return undefined;
        token += command[index];
      } else token += character;
      tokenStarted = true;
      continue;
    }

    if (character === "'") {
      quote = 'single';
      tokenStarted = true;
    } else if (character === '"') {
      quote = 'double';
      tokenStarted = true;
    } else if (/\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(token);
        token = '';
        tokenStarted = false;
      }
    } else if (character === '\\') {
      index += 1;
      if (index >= command.length) return undefined;
      token += command[index];
      tokenStarted = true;
    } else {
      token += character;
      tokenStarted = true;
    }
  }

  if (quote !== undefined) return undefined;
  if (tokenStarted) tokens.push(token);
  return tokens.length > 0 ? tokens : undefined;
}

function isPrimaryBranchReference(value: string): boolean {
  return /(?:^|[/=:])(?:main|master|trunk)(?:$|[/~^])/.test(value.toLowerCase());
}

function isHeadReference(value: string): boolean {
  return value.toLowerCase() === 'head' || /(?:^|[/=:])head(?:$|[/~^])/.test(value.toLowerCase());
}

function hasDeniedFlag(tokens: readonly string[], flags: readonly string[]): boolean {
  return tokens.some((token) => flags.includes(token.toLowerCase()));
}

function isGitStatus(tokens: readonly string[]): boolean {
  return tokens.slice(2).every((token) => ['--short', '--porcelain', '--branch'].includes(token));
}

function isGitDiff(tokens: readonly string[]): boolean {
  return tokens
    .slice(2)
    .every((token) => ['--stat', '--cached', '--name-only', '--name-status', '--'].includes(token));
}

function isGitAdd(tokens: readonly string[]): boolean {
  const args = tokens.slice(2);
  return (
    args.length > 0 &&
    args.every(
      (token) =>
        ['--all', '-A', '--update', '-u', '.'].includes(token) ||
        (!token.startsWith('-') && !isPrimaryBranchReference(token)),
    )
  );
}

function isGitCommit(tokens: readonly string[]): boolean {
  const args = tokens.slice(2);
  if (
    args.length < 2 ||
    args.some((token) =>
      ['--amend', '--no-verify', '--no-gpg-sign'].some(
        (flag) => token.toLowerCase() === flag || token.toLowerCase().startsWith(`${flag}=`),
      ),
    )
  )
    return false;

  let messageArgument = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '-m' || token === '--message' || token === '-F' || token === '--file') {
      if (messageArgument || args[index + 1] === undefined || args[index + 1].startsWith('-')) {
        return false;
      }
      messageArgument = true;
      index += 1;
    } else if (token !== '-a' && token !== '--all') {
      return false;
    }
  }

  return messageArgument;
}

function isGitPush(tokens: readonly string[]): boolean {
  const args = tokens.slice(2);
  if (
    args.length === 0 ||
    hasDeniedFlag(args, ['-f', '--force', '--force-with-lease', '-d', '--delete']) ||
    args.some((token) => token.startsWith('-') && token !== '-u' && token !== '--set-upstream')
  ) {
    return false;
  }

  const positional = args.filter((token) => !token.startsWith('-'));
  if (positional.length !== 2) return false;
  const refParts = positional[1].split(':');
  if (refParts.length > 2 || refParts.some((ref) => !ref)) return false;
  return refParts.every((ref) => !isHeadReference(ref) && !isPrimaryBranchReference(ref));
}

function isVpCheck(tokens: readonly string[]): boolean {
  return tokens.length === 2 && (tokens[1] === 'check' || tokens[1] === 'test');
}

function isGhPullRequest(tokens: readonly string[]): boolean {
  const args = tokens.slice(3);
  if (args.length === 0) return false;
  if (tokens[2] !== 'create' && tokens[2] !== 'edit') return false;
  let base: string | undefined;
  let head: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--base' || token === '--head') {
      const value = args[index + 1];
      if (!value) return false;
      if (token === '--base') base = value;
      else head = value;
      index += 1;
    } else if (token.startsWith('--base=') || token.startsWith('--head=')) {
      const value = token.slice(token.indexOf('=') + 1);
      if (!value) return false;
      if (token.startsWith('--base=')) base = value;
      else head = value;
    } else if (token === '--repo' || token.startsWith('--repo=')) {
      return false;
    } else if (token === '--merge' || token === '--close' || token === '--delete') {
      return false;
    }
  }

  if (tokens[2] === 'edit') return base === undefined && head === undefined;
  return Boolean(base && head && isPrimaryBranchReference(base) && !isPrimaryBranchReference(head));
}

function executableName(token: string): string {
  const slash = token.lastIndexOf('/');
  return (slash >= 0 ? token.slice(slash + 1) : token).toLowerCase();
}

function findShippingInvocation(tokens: readonly string[]): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    const executable = executableName(tokens[index]);
    if (executable === 'git') {
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        const token = tokens[cursor];
        if (token === '-C' || token === '-c' || token === '--git-dir' || token === '--work-tree') {
          cursor += 1;
          continue;
        }
        if (token.startsWith('-')) continue;
        return ['add', 'commit', 'push', 'merge', 'rebase', 'reset', 'clean', 'branch'].includes(
          token,
        );
      }
    }
    if (executable === 'gh' && tokens[index + 1] === 'pr') {
      return ['create', 'edit', 'merge', 'close', 'delete'].includes(tokens[index + 2] ?? '');
    }
    if (executable === 'hub' && tokens[index + 1] === 'pull-request') return true;
    if (executable === 'glab' && tokens[index + 1] === 'mr') {
      return ['create', 'edit', 'merge', 'close', 'delete'].includes(tokens[index + 2] ?? '');
    }
  }
  return false;
}

const UNKNOWN_SHELL_SHIPPING_PATTERN =
  /\b(?:git(?:\s+\S+){0,8}\s+(?:add|commit|push|merge|rebase|reset|clean|branch)\b|gh\s+pr\s+(?:create|edit|merge|close|delete)\b|hub\s+pull-request\b|glab\s+mr\s+(?:create|edit|merge|close|delete)\b)/i;

/** Commands which represent a commit, push, or PR shipping attempt. */
export function isShippingCommand(command: unknown): boolean {
  const tokens = tokenizeShippingCommand(command);
  if (!tokens) return typeof command === 'string' && UNKNOWN_SHELL_SHIPPING_PATTERN.test(command);
  if (findShippingInvocation(tokens)) return true;

  const wrapper = executableName(tokens[0]);
  return (
    ['bash', 'fish', 'node', 'perl', 'python', 'ruby', 'sh', 'zsh'].includes(wrapper) &&
    typeof command === 'string' &&
    UNKNOWN_SHELL_SHIPPING_PATTERN.test(command)
  );
}

/** Commands permitted by the approved landing-review state. */
export function isApprovedShippingCommand(command: unknown): boolean {
  const tokens = tokenizeShippingCommand(command);
  if (!tokens) return false;

  if (tokens[0] === 'git') {
    if (tokens[1] === 'status') return isGitStatus(tokens);
    if (tokens[1] === 'diff') return isGitDiff(tokens);
    if (tokens[1] === 'add') return isGitAdd(tokens);
    if (tokens[1] === 'commit') return isGitCommit(tokens);
    if (tokens[1] === 'push') return isGitPush(tokens);
    return false;
  }

  if (tokens[0] === 'vp') return isVpCheck(tokens);
  if (tokens[0] === 'gh' && tokens[1] === 'pr') return isGhPullRequest(tokens);
  return false;
}

export async function isApprovedShippingCommandOnNonPrimaryBranch(
  command: unknown,
  readCurrentBranch: () => Promise<unknown>,
): Promise<boolean> {
  if (!isApprovedShippingCommand(command)) return false;
  const tokens = tokenizeShippingCommand(command);
  if (!tokens || tokens[0] !== 'git' || !['commit', 'push'].includes(tokens[1] ?? '')) return true;

  try {
    const branch = await readCurrentBranch();
    return (
      typeof branch === 'string' &&
      branch.trim().length > 0 &&
      !isHeadReference(branch.trim()) &&
      !isPrimaryBranchReference(branch.trim())
    );
  } catch {
    return false;
  }
}
