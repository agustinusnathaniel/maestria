// Git safety: blocks hook bypasses, asks before risky history edits and
// protected-branch commits or pushes. `parseGit` is also shared with the
// email policy, which reads `git commit` message text.

import type { Decision, ShellContext } from './types.js';
import { ALLOW, ask, block, strictest } from './types.js';
import { basename, hasLong, positionals, program, shortFlags, splitCommands } from './shell.js';

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
  /** A one-off `-c core.hooksPath=...`, which points this command's hooks elsewhere. */
  readonly hooksPathOverride: boolean;
  readonly subcommand: string;
}

const HOOKS_PATH_OVERRIDE = /^core\.hookspath=/iu;

export const parseGit = (words: readonly string[]): GitCommand | undefined => {
  if (words.length === 0 || basename(words[0]) !== 'git') {
    return undefined;
  }
  let directory: string | undefined;
  let hooksPathOverride = false;
  let index = 1;
  while (index < words.length && words[index].startsWith('-')) {
    if (GIT_VALUED_OPTIONS.has(words[index])) {
      if (words[index] === '-C') {
        directory = directory === undefined ? words[index + 1] : `${directory}/${words[index + 1]}`;
      }
      if (words[index] === '-c' && HOOKS_PATH_OVERRIDE.test(words[index + 1] ?? '')) {
        hooksPathOverride = true;
      }
      index += 2;
    } else {
      index += 1;
    }
  }
  if (index >= words.length) {
    return undefined;
  }
  return { args: words.slice(index + 1), directory, hooksPathOverride, subcommand: words[index] };
};

export const PROTECTED_BRANCH = /^(?:main|develop|staging|release\/.+)$/u;

const isProtected = (branch: string | undefined): branch is string =>
  branch !== undefined && PROTECTED_BRANCH.test(branch);

const COMMIT_VALUED_SHORT = 'mFCctS';
const PUSH_VALUED = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

const branchName = (ref: string): string => ref.replace(/^refs\/heads\//u, '');

const skipsHooks = (bypass: string): Decision =>
  block(`${bypass} skips repository hooks; let the hooks run and fix what they report`);

const classifyCommit = (git: GitCommand, context: ShellContext): Decision => {
  if (hasLong(git.args, '--no-verify') || shortFlags(git.args, COMMIT_VALUED_SHORT).has('n')) {
    return skipsHooks('git commit --no-verify');
  }
  if (git.hooksPathOverride) {
    return skipsHooks('git -c core.hooksPath=... commit');
  }
  const branch = context.currentBranch(git.directory);
  return isProtected(branch)
    ? ask(`git commit on the protected branch ${branch}; create a feature branch first`)
    : ALLOW;
};

const classifyPush = (git: GitCommand, context: ShellContext): Decision => {
  if (hasLong(git.args, '--no-verify')) {
    return skipsHooks('git push --no-verify');
  }
  if (git.hooksPathOverride) {
    return skipsHooks('git -c core.hooksPath=... push');
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
