#!/usr/bin/env node
// Fail-closed consolidated E2E evidence (TypeScript, Node builtins and yaml).
//
// Usage: pnpm e2e:fail-closed (node --experimental-strip-types
//   scripts/e2e/fail-closed-evidence.ts --out artifacts/fail-closed-evidence.json)
//
// Retained native-adapter evidence: permission narrowing, state/guarded Git,
// and sync mechanics. Hermes Python probes were retired with its adapter.
// Output is deterministic, with normalized temporary paths and no timestamps.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseDocument } from 'yaml';

import { isReadOnlyBashCommand } from '../../packages/shared/pi/src/bash-policy.ts';
import { stateFromSessionEntries } from '../../packages/shared/pi/src/state-core.ts';

interface EvidenceCheck {
  detail: string;
  name: string;
  pass: boolean;
}

interface EvidenceSection {
  checks: EvidenceCheck[];
  name: string;
}

const scriptDir = import.meta.dirname;
const repoRoot = path.resolve(scriptDir, '../..');

const outArg = process.argv[process.argv.indexOf('--out') + 1];
if (outArg === undefined || outArg === '') {
  process.stderr.write('usage: fail-closed-evidence.ts --out <path>\n');
  process.exit(2);
}
const outPath = path.resolve(repoRoot, outArg);

const tmpRoot = fs.mkdtempSync(path.join(tmpdir(), 'fail-closed-'));
const sections: EvidenceSection[] = [];

const normalize = (value: string): string => value.split(tmpRoot).join('<TMP>');

const check = (name: string, pass: boolean, detail = ''): EvidenceCheck => ({
  detail: normalize(detail),
  name,
  pass,
});

interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

interface RunResult {
  exit: number;
  stderr: string;
  stdout: string;
}

const run = (cmd: string, cmdArgs: readonly string[], options: RunOptions = {}): RunResult => {
  const result = spawnSync(cmd, [...cmdArgs], {
    cwd: options.cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...options.env },
  });
  return {
    exit: result.status ?? 1,
    stderr: result.stderr,
    stdout: result.stdout,
  };
};

// ── Section 1: permission narrowing + guarded recon restoration ──
// Recon roles auto-allow only the exact guarded git prefix enforced by
// bash-policy.ts; bare git forms, find, and test runners stay at ask.

type PermissionFile = Record<'bash' | 'other' | 'task', Record<string, string>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseAgentPermissions = (text: string): PermissionFile => {
  const perm: PermissionFile = { bash: {}, other: {}, task: {} };
  let parsed: unknown;
  try {
    const document = parseDocument(text.split('---\n')[1] ?? '');
    if (document.errors.length > 0) {
      return perm;
    }
    parsed = document.toJS();
  } catch {
    // Alias expansion can throw after a document parses without errors.
    return perm;
  }
  if (!isRecord(parsed) || !isRecord(parsed.permission)) {
    return perm;
  }
  for (const [key, value] of Object.entries(parsed.permission)) {
    if (key === 'bash' || key === 'task') {
      if (isRecord(value)) {
        for (const [pattern, level] of Object.entries(value)) {
          if (typeof level === 'string') {
            perm[key][pattern] = level;
          }
        }
      }
    } else if (typeof value === 'string') {
      perm.other[key] = value;
    }
  }
  return perm;
};

const EXPECTED_AGENTS: readonly string[] = [
  'adventurer.md',
  'architect.md',
  'builder.md',
  'diagnose.md',
  'orchestrator.md',
  'planner.md',
  'reviewer.md',
  'writer.md',
];

const RECON_AGENTS: readonly string[] = [
  'adventurer.md',
  'architect.md',
  'planner.md',
  'reviewer.md',
  'writer.md',
];

const E2E_GUARDED_GIT =
  'git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium';

const RESTORED_GUARDED: readonly string[] = [
  `${E2E_GUARDED_GIT} status*`,
  `${E2E_GUARDED_GIT} diff --no-ext-diff --no-textconv*`,
  `${E2E_GUARDED_GIT} log --no-ext-diff --no-textconv*`,
  `${E2E_GUARDED_GIT} show --no-ext-diff --no-textconv*`,
  `${E2E_GUARDED_GIT} branch --list*`,
  `${E2E_GUARDED_GIT} branch --show-current*`,
];

const UNGARDED_GIT: readonly string[] = ['git log*', 'git diff*', 'git show*', 'git branch*'];

type BashLookup = (name: string) => Record<string, string>;

const restoredReconChecks = (bash: BashLookup): EvidenceCheck[] =>
  RECON_AGENTS.flatMap((name) =>
    RESTORED_GUARDED.map((pattern) =>
      check(
        `${name} allows ${pattern}`,
        bash(name)[pattern] === 'allow',
        bash(name)[pattern] ?? '',
      ),
    ),
  );

const stillDeniedReconChecks = (bash: BashLookup): EvidenceCheck[] =>
  RECON_AGENTS.flatMap((name) => [
    ...UNGARDED_GIT.map((pattern) =>
      check(
        `${name} has no ${pattern}`,
        bash(name)[pattern] === undefined,
        bash(name)[pattern] ?? '',
      ),
    ),
    check(`${name} has no find allow`, bash(name)['find*'] !== 'allow', bash(name)['find*'] ?? ''),
    check(`${name} has no pnpm allow`, bash(name)['pnpm*'] !== 'allow', bash(name)['pnpm*'] ?? ''),
    check(`${name} has no npm allow`, bash(name)['npm*'] !== 'allow', bash(name)['npm*'] ?? ''),
    check(`${name} has no git blanket`, bash(name)['git*'] !== 'allow', bash(name)['git*'] ?? ''),
  ]);

const sectionPermissionNarrowing = (): void => {
  const agentsDir = path.join(repoRoot, 'packages/opencode/agents');
  const onDisk = fs.readdirSync(agentsDir).filter((name) => name.endsWith('.md'));
  const perms = new Map(
    EXPECTED_AGENTS.map(
      (name) =>
        [
          name,
          parseAgentPermissions(fs.readFileSync(path.join(agentsDir, name), 'utf-8')),
        ] as const,
    ),
  );
  const bash = (name: string): Record<string, string> => perms.get(name)?.bash ?? {};
  const other = (name: string): Record<string, string> => perms.get(name)?.other ?? {};
  const task = (name: string): Record<string, string> => perms.get(name)?.task ?? {};

  const denies: EvidenceCheck[] = [
    check(
      'expected agent set unchanged',
      onDisk.length === EXPECTED_AGENTS.length &&
        EXPECTED_AGENTS.every((name) => onDisk.includes(name)),
      onDisk.join(','),
    ),
    ...EXPECTED_AGENTS.map((name) =>
      check(
        `${name} has no blanket bash allow`,
        bash(name)['*'] !== 'allow',
        bash(name)['*'] ?? '',
      ),
    ),
    check('orchestrator denies shell', bash('orchestrator.md')['*'] === 'deny'),
    check('orchestrator denies edits', other('orchestrator.md').edit === 'deny'),
    check('adventurer denies edits', other('adventurer.md').edit === 'deny'),
    check('architect denies edits', other('architect.md').edit === 'deny'),
    check('reviewer denies edits', other('reviewer.md').edit === 'deny'),
    check('adventurer asks on shell', bash('adventurer.md')['*'] === 'ask'),
    check('architect asks on shell', bash('architect.md')['*'] === 'ask'),
    check('reviewer asks on shell', bash('reviewer.md')['*'] === 'ask'),
  ];
  const allows: EvidenceCheck[] = [
    check('builder keeps du allow', bash('builder.md')['du*'] === 'allow'),
    check('builder asks on fallback shell', bash('builder.md')['*'] === 'ask'),
    check('builder allows edits', other('builder.md').edit === 'allow'),
    check('orchestrator delegates to builder', task('orchestrator.md').builder === 'allow'),
    check('orchestrator denies open task routing', task('orchestrator.md')['*'] === 'deny'),
    check('planner asks on edits', other('planner.md').edit === 'ask'),
    check('writer allows edits', other('writer.md').edit === 'allow'),
    check('diagnose allows edits', other('diagnose.md').edit === 'allow'),
  ];
  sections.push({
    checks: [...denies, ...allows, ...restoredReconChecks(bash), ...stillDeniedReconChecks(bash)],
    name: 'permission-narrowing',
  });
};

// Safety, state, and guarded Git evidence for retained native adapters.

const GUARDED_GIT =
  'git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium';

const deniedCommands = (): EvidenceCheck[] => {
  const cases: readonly (readonly [string, string])[] = [
    ['unguarded git status fails', 'git status'],
    ['git push fails', `${GUARDED_GIT} push`],
    ['signature smuggling fails', `${GUARDED_GIT} log --no-ext-diff --no-textconv --format=%G`],
    ['unguarded log fails', 'git --no-pager log --oneline'],
    ['piped destructive fails', 'ls | rm -rf dist'],
    ['destructive root fails', 'rm -rf /'],
    ['grep bundle fails', 'grep -rn foo'],
    ['ls unsafe flag fails', 'ls --bogus'],
    ['find output form fails', 'find . -print'],
    ['find exec form fails', 'find . -exec rm {} ;'],
    ['guarded branch delete fails', `${GUARDED_GIT} branch -D topic`],
    [
      'guarded log custom format fails',
      `${GUARDED_GIT} log --no-ext-diff --no-textconv --format=%H`,
    ],
    ['pnpm test fails', 'pnpm test'],
    ['npm run fails', 'npm run build'],
  ];
  return cases.map(([name, command]) => check(name, !isReadOnlyBashCommand(command), command));
};

const allowedCommands = (): EvidenceCheck[] => {
  const cases: readonly (readonly [string, string])[] = [
    ['guarded status passes', `${GUARDED_GIT} status --short --branch`],
    ['guarded log passes', `${GUARDED_GIT} log --no-ext-diff --no-textconv --oneline`],
    ['guarded diff passes', `${GUARDED_GIT} diff --no-ext-diff --no-textconv --stat`],
    ['guarded show passes', `${GUARDED_GIT} show --no-ext-diff --no-textconv --stat`],
    ['guarded branch list passes', `${GUARDED_GIT} branch --list`],
    ['guarded branch show-current passes', `${GUARDED_GIT} branch --show-current`],
    ['plain ls passes', 'ls -la'],
    ['plain grep passes', 'grep -r foo src/'],
    [
      'piped read-only passes',
      `${GUARDED_GIT} log --no-ext-diff --no-textconv --oneline | head -5`,
    ],
  ];
  return cases.map(([name, command]) => check(name, isReadOnlyBashCommand(command), command));
};

const persistedStateChecks = (): EvidenceCheck[] => {
  const hostile: unknown = JSON.parse(
    '{"__proto__":{"polluted":true},"mode":"weird","reviewMode":"yes","blockers":["a",1]}',
  );
  const hostileState = stateFromSessionEntries([
    { customType: 'maestria_state', data: hostile, type: 'custom' },
  ]);
  const restored = stateFromSessionEntries([
    { customType: 'maestria_state', data: { activeTask: 't', mode: 'sonar' }, type: 'custom' },
    { data: 'noise', type: 'message' },
  ]);
  return [
    check(
      'proto-pollution dropped',
      ({} as Record<string, unknown>).polluted === undefined && !('polluted' in hostileState),
    ),
    check('invalid mode falls back to fein', hostileState.mode === 'fein', hostileState.mode ?? ''),
    check('non-boolean reviewMode becomes true', hostileState.reviewMode),
    check(
      'non-string blockers filtered',
      JSON.stringify(hostileState.blockers) === '["a"]',
      JSON.stringify(hostileState.blockers),
    ),
    check(
      'valid branch state restores',
      restored.activeTask === 't' && restored.mode === 'sonar',
      `${restored.activeTask}/${restored.mode ?? ''}`,
    ),
    check('empty branch resets', stateFromSessionEntries([]).mode === null),
  ];
};

const sectionSafetyState = (): void => {
  sections.push({
    checks: [...deniedCommands(), ...allowedCommands(), ...persistedStateChecks()],
    name: 'safety-state-git',
  });
};

// ── Section 4: sync mechanics ──

const porcelain = (): string => run('git', ['status', '--porcelain=v1'], { cwd: repoRoot }).stdout;

const sectionSync = (): void => {
  const before = porcelain();
  const syncRun = run('bash', ['scripts/sync-all'], { cwd: repoRoot });
  const after = porcelain();
  const checkRun = run('bash', ['scripts/check-sync'], { cwd: repoRoot });
  sections.push({
    checks: [
      check(
        'check-sync exits 0',
        checkRun.exit === 0,
        (checkRun.stderr || checkRun.stdout).slice(-1000),
      ),
      check(
        'sync-all exits 0',
        syncRun.exit === 0,
        (syncRun.stderr || syncRun.stdout).slice(-1000),
      ),
      check('sync-all writes nothing', before === after),
    ],
    name: 'sync',
  });
};

// ── Deterministic output ──
// JSON key order is fixed by construction: every object literal below
// declares keys alphabetically, probe payloads pass through the sorted
// EvidenceCheck constructor, and JSON.stringify preserves insertion order
// with LF endings. No timestamps or absolute paths enter the report.

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

interface EvidenceReport {
  artifact: string;
  generator: string;
  sections: EvidenceSection[];
  summary: {
    checks: number;
    failed: number;
    passed: number;
    sections: number;
    sha256: string;
  };
}

const main = (): void => {
  sectionPermissionNarrowing();
  sectionSafetyState();
  sectionSync();

  const flat = sections.flatMap((section) => section.checks);
  const passed = flat.filter((item) => item.pass).length;
  const report: EvidenceReport = {
    artifact: 'artifacts/fail-closed-evidence.json',
    generator: 'scripts/e2e/fail-closed-evidence.ts',
    sections,
    summary: {
      checks: flat.length,
      failed: flat.length - passed,
      passed,
      sections: sections.length,
      sha256: '',
    },
  };
  report.summary.sha256 = sha256(`${JSON.stringify(report)}\n`);
  const body = `${JSON.stringify(report, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body);

  for (const section of sections) {
    const sectionPassed = section.checks.filter((item) => item.pass).length;
    const mark = sectionPassed === section.checks.length ? 'pass' : 'FAIL';
    process.stdout.write(`[${mark}] ${section.name} (${sectionPassed}/${section.checks.length})\n`);
  }
  process.stdout.write(
    `fail-closed evidence: ${sections.length} sections, ${flat.length} checks, ${passed} passed, ${flat.length - passed} failed\nartifact: ${outPath}\n`,
  );
  if (!fs.existsSync(outPath) || fs.readFileSync(outPath, 'utf-8') !== body) {
    process.stdout.write('artifact write mismatch\n');
    process.exit(1);
  }
  process.exit(flat.length === passed ? 0 : 1);
};

main();
