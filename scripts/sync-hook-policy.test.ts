import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { hookPolicyModule, syncHookPolicy } from './sync-hook-policy.js';

// Hooks fail open on crashes; exercise generated code and rejected builds at the release boundary.

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-hook-policy-'));
  tempDirs.push(dir);
  return dir;
};

const SRC = path.join('packages', 'shared', 'hook-policy', 'src');

const makeRepo = (files: Record<string, string>): string => {
  const root = tempDir();
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, SRC, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf-8');
  }
  return root;
};

const loadCode = async <T>(code: string): Promise<T> => {
  const file = path.join(tempDir(), 'policy.mjs');
  fs.writeFileSync(file, code, 'utf-8');
  const loaded: unknown = await import(pathToFileURL(file).href);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tests read only the documented fixture exports.
  return loaded as T;
};

/** Independent expected surface of the real policy entry. */
const EXPECTED_POLICY_EXPORTS = [
  'ALLOW',
  'PROTECTED_BRANCH',
  'classifyEmailScan',
  'classifyEnvDump',
  'classifyGeneratedEdit',
  'classifyGitSafety',
  'editTargets',
  'findEmails',
  'generatedMarker',
  'maskEmail',
  'outgoingText',
  'splitCommands',
  'strictest',
];

interface PolicySmoke {
  classifyEnvDump: (command: string) => { verdict: string };
  classifyGitSafety: (
    command: string,
    context: { currentBranch: () => string },
  ) => { verdict: string };
}

interface AliasFixture {
  askAlias: (reason: string) => string;
  helperName: string;
  make: (box: { value: string }) => string;
  policyTag: string;
  topValue: string;
}

const validFixture = (): Record<string, string> => ({
  'format.ts': 'export const format = (text: string): string => text;\n',
  'index.ts': "export { ask } from './policy.js';\n",
  'policy.ts':
    "import { format } from './format.js';\n" +
    'export const ask = (reason: string): string => format(reason);\n',
});

describe('hookPolicyModule', () => {
  it('rejects a symlinked entry outside the source tree', async () => {
    const root = makeRepo({ '../outside.ts': 'export const value = 123;\n' });
    fs.mkdirSync(path.join(root, SRC), { recursive: true });
    fs.symlinkSync('../outside.ts', path.join(root, SRC, 'index.ts'));
    await expect(hookPolicyModule(root)).rejects.toThrow('outside');
  });

  it('produces the same artifact from another working directory', async () => {
    const root = makeRepo(validFixture());
    const code = await hookPolicyModule(root);
    const cwd = process.cwd();
    try {
      process.chdir(root);
      expect(await hookPolicyModule(root)).toBe(code);
    } finally {
      process.chdir(cwd);
    }
  });

  it('bundles the real entry import-free with the exact public surface', async () => {
    const repoRoot = path.resolve(import.meta.dirname, '..');
    const code = await hookPolicyModule(repoRoot);
    expect(code).not.toMatch(/^\s*import\b/mu);
    expect(code).not.toMatch(/\bimport\s*\(/u);
    expect(await hookPolicyModule(repoRoot)).toBe(code);

    const policy = await loadCode<PolicySmoke & Record<string, unknown>>(code);
    expect(Object.keys(policy).toSorted()).toEqual([...EXPECTED_POLICY_EXPORTS].toSorted());

    expect(policy.classifyEnvDump('env | grep TOKEN').verdict).toBe('ask');
    expect(policy.classifyEnvDump('printenv HOME').verdict).toBe('allow');
    expect(
      policy.classifyGitSafety('git commit --no-verify -m x', { currentBranch: () => 'feature/x' })
        .verdict,
    ).toBe('block');
  });

  it('supports aliases, module scope, and top-level dependency evaluation', async () => {
    const root = makeRepo({
      'format.ts': 'export const format = (text: string): string => text.trim();\n',
      'index.ts':
        "export { ask as askAlias, make, policyTag } from './policy.js';\n" +
        "export { helperName, topValue } from './other.js';\n",
      'other.ts':
        "import { format } from './format.js';\n" +
        "const SHARED = 'from-other';\n" +
        'export const helperName = SHARED;\n' +
        "export const topValue = format('  hi  ');\n",
      'policy.ts':
        "import { format as fmt } from './format.js';\n" +
        "const PREFIX = 'maestria: ';\n" +
        'export const ask = (reason: string): string => fmt(PREFIX + reason);\n' +
        'export const make = (box: { value: string }): string => fmt(box.value);\n' +
        "const SHARED = 'from-policy';\n" +
        'export const policyTag = SHARED;\n',
    });
    const bundle = await loadCode<AliasFixture>(await hookPolicyModule(root));
    expect(Object.keys(bundle).toSorted()).toEqual(
      ['askAlias', 'helperName', 'make', 'policyTag', 'topValue'].toSorted(),
    );
    expect(bundle.askAlias('hi')).toBe('maestria: hi');
    expect(bundle.make({ value: '  ok  ' })).toBe('ok');
    expect(bundle.policyTag).toBe('from-policy');
    expect(bundle.helperName).toBe('from-other');
    expect(bundle.topValue).toBe('hi');
  });

  const failures: { files: Record<string, string>; label: string; pattern: RegExp }[] = [
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import { x } from 'some-package';\nexport const a = x;\n",
      },
      label: 'external import',
      pattern: /only relative imports/u,
    },
    {
      files: {
        '../other.ts': 'export const x = 1;\n',
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import { x } from '../other.js';\nexport const a = x;\n",
      },
      label: 'parent-relative escape',
      pattern: /outside/u,
    },
    {
      files: {
        '../src-evil.ts': 'export const x = 1;\n',
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import { x } from '../src-evil.js';\nexport const a = x;\n",
      },
      label: 'sibling-prefix escape',
      pattern: /outside/u,
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'other.ts': 'export const x = 1;\n',
        'part.ts': 'export const a = import("./other.js");\n',
      },
      label: 'dynamic import',
      pattern: /dynamic imports|import-free/u,
    },
    {
      files: { 'index.ts': "export { a } from './missing.js';\n" },
      label: 'missing source',
      pattern: /build failed|Could not resolve|missing/iu,
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': 'export const = 1;\n',
      },
      label: 'invalid module',
      pattern: /build failed|Unexpected token|parse|syntax/iu,
    },
  ];

  it.each(failures.map((failure) => [failure.label, failure.files, failure.pattern] as const))(
    'fails loud on %s',
    async (_label, files, pattern) => {
      await expect(hookPolicyModule(makeRepo(files))).rejects.toThrow(pattern);
    },
  );
});

describe('syncHookPolicy', () => {
  it('writes once and is then in sync', async () => {
    const root = makeRepo(validFixture());
    const target = path.join(root, 'packages', 'agent-plugins', 'hooks', 'lib', 'policy.mjs');
    expect(await syncHookPolicy(root, false)).toHaveLength(1);
    expect(fs.existsSync(target)).toBe(true);
    expect(await syncHookPolicy(root, false)).toEqual([]);
    expect(await syncHookPolicy(root, true)).toEqual([]);
  });

  it('check mode reports drift without writing and stays idempotent', async () => {
    const root = makeRepo(validFixture());
    const target = path.join(root, 'packages', 'agent-plugins', 'hooks', 'lib', 'policy.mjs');
    expect(await syncHookPolicy(root, true)).toHaveLength(1);
    expect(fs.existsSync(target)).toBe(false);
    expect(await syncHookPolicy(root, false)).toHaveLength(1);
    expect(await syncHookPolicy(root, true)).toEqual([]);
  });
});
