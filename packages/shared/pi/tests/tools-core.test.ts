import { describe, it, expect } from 'vite-plus/test';
import { DANGEROUS_PATTERNS, isReadOnlyBashCommand } from '../src/tools-core.js';

// ── isReadOnlyBashCommand ────────────────────────────────────────────

describe('isReadOnlyBashCommand', () => {
  it('allows plain read-only commands', () => {
    expect(isReadOnlyBashCommand('git status')).toBe(true);
    expect(isReadOnlyBashCommand('git diff --stat')).toBe(true);
    expect(isReadOnlyBashCommand('git log --oneline')).toBe(true);
    expect(isReadOnlyBashCommand('ls -la')).toBe(true);
    expect(isReadOnlyBashCommand('grep -r foo src/')).toBe(true);
    expect(isReadOnlyBashCommand('find . -name "*.ts"')).toBe(true);
    expect(isReadOnlyBashCommand('pwd')).toBe(true);
    expect(isReadOnlyBashCommand('which node')).toBe(true);
  });

  it('allows read-only pipelines and fd redirects', () => {
    expect(isReadOnlyBashCommand('git log --oneline | head -5')).toBe(true);
    expect(isReadOnlyBashCommand('git diff --stat | grep src')).toBe(true);
    expect(isReadOnlyBashCommand('git status 2>&1')).toBe(true);
  });

  it('allows test commands for verification', () => {
    expect(isReadOnlyBashCommand('pnpm test')).toBe(true);
    expect(isReadOnlyBashCommand('pnpm test --run tools')).toBe(true);
    expect(isReadOnlyBashCommand('npm test')).toBe(true);
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

// ── DANGEROUS_PATTERNS ───────────────────────────────────────────────

describe('DANGEROUS_PATTERNS', () => {
  it('catches destructive commands', () => {
    for (const command of ['rm -rf /', 'dd if=/dev/zero of=/dev/sda', 'mkfs.ext4 /dev/sdb']) {
      expect(DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))).toBe(true);
    }
  });

  it('does not match benign commands', () => {
    for (const command of ['ls -la', 'git status', 'pnpm test']) {
      expect(DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))).toBe(false);
    }
  });
});
