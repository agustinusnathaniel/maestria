import { describe, expect, it } from 'vite-plus/test';

import {
  classifyEmailScan,
  classifyEnvDump,
  classifyGeneratedEdit,
  classifyGitSafety,
  editTargets,
  findEmails,
  generatedMarker,
  splitCommands,
} from '@/index.js';
import type { ShellContext } from '@/index.js';

const on = (branch?: string, files: Record<string, string> = {}): ShellContext => ({
  currentBranch: () => branch,
  readFile: (file) => files[file],
});
const verdict = (command: string, context = on('feature/x')): string =>
  classifyGitSafety(command, context).verdict;

describe('git safety classifier', () => {
  it.each([
    'git commit --no-verify -m "x"',
    'git commit -n -m x',
    'git commit -anm x',
    'git push --no-verify',
    'cd repo && git -C . commit --no-verify',
    'git -c core.hooksPath=/dev/null commit -m x',
    'git -c core.hooksPath= push origin feature/x',
  ])('blocks hook bypass: %s', (command) => {
    expect(verdict(command)).toBe('block');
  });

  it('names a one-off core.hooksPath as the bypass', () => {
    expect(classifyGitSafety('git -c core.hooksPath=x commit -m x', on('feature/x')).reason).toBe(
      'git -c core.hooksPath=... commit skips repository hooks; let the hooks run and fix what they report',
    );
  });

  it.each([
    'git push --force',
    'git push -f origin feature/x',
    'git push --force-with-lease',
    'git push --force-with-lease=feature/x:abc',
    'git push origin +feature/x',
    'git push origin feature/x:main',
    'git push origin HEAD:refs/heads/release/1.2',
    'git push --all',
    'git reset --hard HEAD~1',
    'git clean -fd',
    'git clean --force',
    'git checkout -- src/a.ts',
    'git checkout main -- src/a.ts',
    'git restore src/a.ts',
    'git restore --staged --worktree src/a.ts',
    'git stash drop',
    'npm test; git reset --hard',
  ])('asks before a risky history edit: %s', (command) => {
    expect(verdict(command)).toBe('ask');
  });

  it.each(['main', 'develop', 'staging', 'release/2.0'])(
    'asks before committing or pushing on the protected branch %s',
    (branch) => {
      expect(verdict('git commit -m "fix"', on(branch))).toBe('ask');
      expect(verdict('git push', on(branch))).toBe('ask');
      expect(verdict('git push -u origin', on(branch))).toBe('ask');
    },
  );

  it.each([
    'git commit -m "no -n here, see --no-verify docs"',
    'git commit -m x',
    'git push -u origin feature/x',
    'git push origin feature/x:feature/y',
    'git restore --staged src/a.ts',
    'git checkout -b feature/y',
    'git stash list',
    'git reset --soft HEAD~1',
    'git clean -n',
    'echo "git push --force"',
    'grep -r "git reset --hard" docs',
    'git log --oneline',
    'git config core.hooksPath .husky',
  ])('allows routine or quoted commands: %s', (command) => {
    expect(verdict(command)).toBe('allow');
  });

  it('allows a commit when the branch is unknown', () => {
    expect(verdict('git commit -m x', on())).toBe('allow');
  });

  it('reads the branch of the -C directory', () => {
    const asked: (string | undefined)[] = [];
    classifyGitSafety('git -C ../other commit -m x', {
      currentBranch: (directory) => {
        asked.push(directory);
        return 'main';
      },
    });
    expect(asked).toEqual(['../other']);
  });

  it('keeps the strictest decision across chained commands', () => {
    expect(verdict('git push --force && git commit --no-verify')).toBe('block');
  });

  it('splits on separators outside quotes only', () => {
    expect(splitCommands('a "b && c" && d \'e;f\'; g | h')).toEqual([
      ['a', 'b && c'],
      ['d', 'e;f'],
      ['g'],
      ['h'],
    ]);
  });
});

describe('environment dump guard', () => {
  it.each([
    'env',
    'printenv',
    'printenv -0',
    'env | grep TOKEN',
    'env > out.txt',
    'env>out.txt',
    'printenv>>out.txt',
    'set>out.txt',
    'env 2>/dev/null',
    'env -u HOME',
    'sudo printenv',
    'sudo -u root env',
    '/usr/bin/env',
    'FOO=1 env',
    'env FOO=1 printenv',
    'exec env',
    'echo "$(env)"',
    'echo `printenv`',
    'echo "`env`"',
    'diff <(env) saved.txt',
    '(set -o posix; set)',
    '{ env; }',
    'if true; then env; fi',
    'npm test && printenv',
    'set',
    'set | sort',
    'export',
    'export -p',
    'declare -x',
    'declare -p',
    'declare -px',
    'typeset -x',
    'cat /proc/self/environ',
    "tr '\\0' '\\n' < /proc/1/environ",
    'dd if=/proc/self/environ 2>/dev/null',
    'strings /proc/$$/environ',
    'cat <<EOF\n$(env)\nEOF',
  ])('asks before an environment dump: %s', (command) => {
    expect(classifyEnvDump(command).verdict).toBe('ask');
  });

  it.each([
    'env FOO=1 node app.js',
    'env -i PATH=/usr/bin make',
    'env -u HOME node app.js',
    'env -S "node app.js"',
    'env --help',
    'printenv HOME',
    'printenv HOME PATH',
    'printenv HOME>out.txt',
    'printenv HOME 2>/dev/null',
    'sudo printenv HOME',
    '[ -n "$TOKEN" ] && echo set',
    'set -e',
    'set -euo pipefail',
    'set -o pipefail',
    'set -x',
    'set +e',
    'set -- a b',
    'export FOO=bar',
    'export -n FOO',
    'declare -x FOO=1',
    'declare -p FOO',
    'declare -a list',
    'command -v env',
    'command -v printenv',
    'type env',
    'which printenv',
    'grep printenv file',
    'grep -rn "env" src',
    'echo "run env to list"',
    "echo 'printenv'",
    "echo '$(env)'",
    'echo /proc/self/environ',
    'ls -l /proc/self/environ',
    'test -f /proc/self/environ && echo exists',
    'git commit -m "debug: stop running env and printenv"',
    "git commit -F - <<'EOF'\nfix: avoid dumping the environment\n\nenv\nprintenv\nset\nexport -p\nEOF",
    'cat <<EOF > notes.md\nRun env to list variables.\nenv\nEOF',
    'cat <<\\EOF\nenv\nEOF',
    'git commit -m "$(cat <<\'EOF\'\nUse printenv NAME, not env.\nset\nEOF\n)"',
    'kubectl set env deploy/app FOO=1',
    'pnpm env use --global lts',
    'echo $((1 + 2))',
  ])('allows ordinary use: %s', (command) => {
    expect(classifyEnvDump(command)).toEqual({ reason: '', verdict: 'allow' });
  });

  it('says why and what to read instead', () => {
    const { reason } = classifyEnvDump('env | grep TOKEN');
    expect(reason).toContain('env without a command prints the whole environment');
    expect(reason).toContain('printenv NAME');
    expect(reason).toContain('[ -n "$NAME" ] && echo set');
  });
});

describe('email scan', () => {
  it('finds addresses and skips noreply ones', () => {
    expect(
      findEmails('ping a.person@example.org, 1+x@users.noreply.github.com, noreply@ci.dev'),
    ).toEqual(['a.person@example.org']);
  });

  it.each([
    'gh pr create --title "Fix" --body "Reported by a.person@example.org"',
    'gh pr edit 12 --body=a.person@example.org',
    'gh pr comment 12 -b "cc a.person@example.org"',
    'gh issue create -t x -b a.person@example.org',
    'gh api repos/o/r/issues/1/comments -f body="a.person@example.org"',
    'git commit -m "Co-authored-by: A <a.person@example.org>"',
    'git commit --message=a.person@example.org',
    'git commit -m"thanks a.person@example.org"',
    'gh pr create -ba.person@example.org',
  ])('asks before publishing an email address: %s', (command) => {
    const decision = classifyEmailScan(command, on('feature/x'));
    expect(decision.verdict).toBe('ask');
    expect(decision.reason).not.toContain('a.person@example.org');
    expect(decision.reason).toContain('a***@example.org');
  });

  it('reads body and message files relative to the session', () => {
    const context = on('feature/x', { 'body.md': 'Thanks a.person@example.org' });
    expect(classifyEmailScan('gh pr create --body-file body.md', context).verdict).toBe('ask');
    expect(classifyEmailScan('git commit -F body.md', context).verdict).toBe('ask');
    expect(classifyEmailScan('gh pr create -F missing.md', context).verdict).toBe('allow');
  });

  it.each([
    'gh pr view 12 --json author',
    'git commit -m "Signed-off-by: bot <1+bot@users.noreply.github.com>"',
    'git log --author a.person@example.org',
    'echo a.person@example.org',
  ])('ignores commands that publish no PR, issue, or commit text: %s', (command) => {
    expect(classifyEmailScan(command, on('feature/x')).verdict).toBe('allow');
  });
});

describe('generated-file guard', () => {
  it.each([
    ['// @generated by protoc', '@generated'],
    ['# DO NOT EDIT', 'DO NOT EDIT'],
    [
      '---\nname: x\ndescription: y\n---\n\n<!-- Generated from core. Do not edit directly. -->',
      'Do not edit directly',
    ],
    ['/* Generated by tool */', 'Generated by'],
  ])('finds the marker in the first five lines: %s', (head, marker) => {
    expect(generatedMarker(head)).toBe(marker);
  });

  it('ignores markers past the fifth line', () => {
    expect(generatedMarker('1\n2\n3\n4\n5\n// @generated')).toBeUndefined();
  });

  it('collects edit targets from path fields and apply_patch bodies', () => {
    expect(editTargets({ file_path: 'a.ts' })).toEqual(['a.ts']);
    expect(
      editTargets({
        command:
          '*** Begin Patch\n*** Update File: b.ts\n*** Add File: c.ts\n*** Delete File: d.ts\n',
      }),
    ).toEqual(['b.ts', 'd.ts']);
    expect(editTargets(null)).toEqual([]);
  });

  it('asks before editing a generated file and allows new or ordinary files', () => {
    const heads: Record<string, string> = { 'gen.ts': '// @generated', 'src.ts': 'export {};' };
    const read = (file: string): string | undefined => heads[file];
    expect(classifyGeneratedEdit(['gen.ts'], read).verdict).toBe('ask');
    expect(classifyGeneratedEdit(['src.ts', 'new.ts'], read).verdict).toBe('allow');
  });
});
