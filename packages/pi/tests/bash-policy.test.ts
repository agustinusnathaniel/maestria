import { describe, expect, it } from 'vite-plus/test';

import { isReadOnlyBashCommand } from '@/bash-policy.js';

// Guarded git invocations are the only read-only git form: global safety
// flags are required, diff/log need patch guards, and only safe options pass.
const GUARDED_GIT =
  'git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium';

describe('isReadOnlyBashCommand', () => {
  it('allows safe queries and guarded git commands', () => {
    expect(isReadOnlyBashCommand('ls -la')).toBe(true);
    expect(isReadOnlyBashCommand('grep -r foo src/')).toBe(true);
    expect(isReadOnlyBashCommand('pwd')).toBe(true);
    expect(isReadOnlyBashCommand('which node')).toBe(true);
    expect(isReadOnlyBashCommand(`${GUARDED_GIT} status --short`)).toBe(true);
    expect(isReadOnlyBashCommand(`${GUARDED_GIT} diff --no-ext-diff --no-textconv --stat`)).toBe(
      true,
    );
    expect(
      isReadOnlyBashCommand(`${GUARDED_GIT} log --no-ext-diff --no-textconv --oneline -5`),
    ).toBe(true);
  });

  it('blocks unguarded git, find, and package-manager execution', () => {
    expect(isReadOnlyBashCommand('git status')).toBe(false);
    expect(isReadOnlyBashCommand('git diff --stat')).toBe(false);
    expect(isReadOnlyBashCommand('git log --oneline')).toBe(false);
    expect(isReadOnlyBashCommand('find . -name "*.ts"')).toBe(false);
    expect(isReadOnlyBashCommand('pnpm test')).toBe(false);
    expect(isReadOnlyBashCommand('pnpm test --run tools')).toBe(false);
    expect(isReadOnlyBashCommand('npm test')).toBe(false);
  });

  it('allows guarded pipelines and fd redirects', () => {
    expect(
      isReadOnlyBashCommand(`${GUARDED_GIT} log --no-ext-diff --no-textconv --oneline | head -5`),
    ).toBe(true);
    expect(
      isReadOnlyBashCommand(`${GUARDED_GIT} diff --no-ext-diff --no-textconv --stat | grep src`),
    ).toBe(true);
    expect(isReadOnlyBashCommand(`${GUARDED_GIT} status 2>&1`)).toBe(true);
  });

  it('blocks mutation commands outright', () => {
    expect(isReadOnlyBashCommand('rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('pnpm add lodash')).toBe(false);
    expect(isReadOnlyBashCommand('git checkout -- .')).toBe(false);
    expect(isReadOnlyBashCommand('git push origin main')).toBe(false);
    expect(isReadOnlyBashCommand('git reset --hard')).toBe(false);
  });

  it('blocks chained commands that hide a mutation after a read-only prefix', () => {
    expect(isReadOnlyBashCommand('git status && git checkout .')).toBe(false);
    expect(isReadOnlyBashCommand('git status; git push')).toBe(false);
    expect(isReadOnlyBashCommand('ls; rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('ls | rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('ls || rm -rf dist')).toBe(false);
    expect(isReadOnlyBashCommand('pnpm test & rm -rf dist')).toBe(false);
  });

  it('blocks command substitution and output redirection', () => {
    expect(isReadOnlyBashCommand('ls $(rm -rf dist)')).toBe(false);
    expect(isReadOnlyBashCommand('ls `rm -rf dist`')).toBe(false);
    expect(isReadOnlyBashCommand('cat > file')).toBe(false);
    expect(isReadOnlyBashCommand('git diff >> /tmp/patch.txt')).toBe(false);
    expect(isReadOnlyBashCommand('git status 2> /tmp/err.txt')).toBe(false);
  });

  it('blocks commands chained over a newline', () => {
    expect(isReadOnlyBashCommand('ls\nrm -rf dist')).toBe(false);
  });

  it('rejects empty or leading-separator commands', () => {
    expect(isReadOnlyBashCommand('')).toBe(false);
    expect(isReadOnlyBashCommand('; ls')).toBe(false);
  });
});
