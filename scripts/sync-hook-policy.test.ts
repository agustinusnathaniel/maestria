import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite-plus';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { bundleSources, hookPolicyModule, syncHookPolicy } from './sync-hook-policy.js';

/**
 * Behavior-focused tests for scripts/sync-hook-policy.ts.
 *
 * The bundler inlines the split hook-policy modules into the single
 * import-free artifact that ships beside the plugin hooks. Hooks fail open
 * when their scripts crash, so a wrong bundle silently weakens a guard;
 * these tests pin the bundling behavior release automation depends on -
 * module order, the exact public export surface, and fail-loud handling of
 * anything the bundler cannot express - against throwaway fixture trees
 * under the OS temp dir. They never touch the real repo sources except for
 * the read-only artifact contract test.
 */

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

/** Create a throwaway fixture dir under the OS temp dir, removed after the test. */
const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-hook-policy-'));
  tempDirs.push(dir);
  return dir;
};

const SRC = path.join('packages', 'shared', 'hook-policy', 'src');

/** Create a fixture repo root whose hook-policy sources are `files` (relative to SRC). */
const makeRepo = (files: Record<string, string>): string => {
  const root = tempDir();
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, SRC, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf-8');
  }
  return root;
};

const ENTRY = `export type { Box } from './types.js';
export { ask, make } from './policy.js';
`;

const TYPES = `export interface Box {
  readonly value: string;
}
export type Shout = (text: string) => string;
`;

const POLICY = `import type { Box } from './types.js';
import { format } from './format.js';

const PREFIX = 'maestria: ';

export const ask = (reason: string): string => format(\`\${PREFIX}\${reason}\`);

export const make = (box: Box): string => box.value;
`;

const FORMAT = `export const format = (text: string): string =>
  text
    .split(' ')
    .join(' ');
`;

interface FixtureBundle {
  ask: (reason: string) => string;
  make: (box: { value: string }) => string;
}

const isFixtureBundle = (value: unknown): value is FixtureBundle =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'ask') === 'function' &&
  typeof Reflect.get(value, 'make') === 'function';

interface PolicySmoke {
  classifyEnvDump: (command: string) => { verdict: string };
  classifyGitSafety: (
    command: string,
    context: { currentBranch: () => string },
  ) => { verdict: string };
}

const isPolicySmoke = (value: unknown): value is PolicySmoke =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'classifyEnvDump') === 'function' &&
  typeof Reflect.get(value, 'classifyGitSafety') === 'function';

describe('bundleSources', () => {
  it('inlines modules dependency-first with markers and a single export list', () => {
    const root = makeRepo({
      'format.ts': FORMAT,
      'index.ts': ENTRY,
      'policy.ts': POLICY,
      'types.ts': TYPES,
    });
    const { code, publicNames } = bundleSources(root);
    expect(publicNames).toEqual(['ask', 'make']);
    expect(code).not.toMatch(/^\s*import\b/mu);
    expect(code).not.toMatch(/\bimport\s*\(/u);
    // Dependencies precede their importers, each under its section marker.
    const formatAt = code.indexOf('----- packages/shared/hook-policy/src/format.ts -----');
    const policyAt = code.indexOf('----- packages/shared/hook-policy/src/policy.ts -----');
    expect(formatAt).toBeGreaterThan(-1);
    expect(policyAt).toBeGreaterThan(formatAt);
    // Each module ships once; the entry's public names are exported once at the end.
    expect(code.match(/const PREFIX =/gu)).toHaveLength(1);
    expect(code.trimEnd().endsWith('export { ask, make };')).toBe(true);
  });

  it('executes the bundle with the entry evaluation order', async () => {
    const root = makeRepo({
      'format.ts': FORMAT,
      'index.ts': ENTRY,
      'policy.ts': POLICY,
      'types.ts': TYPES,
    });
    const { code } = bundleSources(root);
    // The shipped artifact is the transformed bundle, so transform here too.
    const { code: shipped } = await transformWithOxc(code, 'bundle.ts', { lang: 'ts' });
    const file = path.join(root, 'bundle.mjs');
    fs.writeFileSync(file, `${shipped}\n`, 'utf-8');
    const bundle: unknown = await import(pathToFileURL(file).href);
    if (!isFixtureBundle(bundle)) {
      throw new Error('fixture bundle exports have an unexpected shape');
    }
    expect(bundle.ask('hello world')).toBe('maestria: hello world');
    expect(bundle.make({ value: 'ok' })).toBe('ok');
  });

  const failures: { label: string; files: Record<string, string>; message: string }[] = [
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import { x } from 'some-package';\nexport const a = x;\n",
      },
      label: 'external import',
      message: 'only relative imports',
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import { x } from '../other.js';\nexport const a = x;\n",
      },
      label: 'parent-relative import',
      message: 'outside',
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import { x } from '../src-evil.js';\nexport const a = x;\n",
      },
      label: 'sibling-prefix escape',
      message: 'outside',
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "import './setup.js';\nexport const a = 1;\n",
      },
      label: 'side-effect import',
      message: 'unparsable import',
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': 'export default 1;\n',
      },
      label: 'default export',
      message: 'default exports are not supported',
    },
    {
      files: {
        'index.ts': "export { a } from './part.js';\n",
        'part.ts': "export { a } from './other.js';\n",
      },
      label: 're-export in a part',
      message: 're-exports only live in the entry',
    },
    {
      files: {
        'a.ts': "import { b } from './b.js';\nexport const a = b;\n",
        'b.ts': "import { a } from './a.js';\nexport const b = a;\n",
        'index.ts': "export { a } from './a.js';\n",
      },
      label: 'circular imports',
      message: 'circular import',
    },
    {
      files: {
        'a.ts':
          "import { helper } from './b.js';\nexport const same = helper;\nexport const a = same;\n",
        'b.ts': 'export const same = 2;\nexport const helper = 3;\n',
        'index.ts': "export { a } from './a.js';\n",
      },
      label: 'duplicate declarations',
      message: 'duplicate declaration same',
    },
    {
      files: { 'index.ts': 'export const a = 1;\n' },
      label: 'garbage entry line',
      message: 'entry supports only named re-exports',
    },
  ];

  it.each(failures.map((failure) => [failure.label, failure.files, failure.message] as const))(
    'fails loud on %s',
    (_label, files, message) => {
      const root = makeRepo(files);
      expect(() => bundleSources(root)).toThrow(message);
    },
  );
});

describe('hookPolicyModule', () => {
  it('rejects dynamic imports in the shipped module', async () => {
    const root = makeRepo({
      'index.ts': "export { a } from './part.js';\n",
      'part.ts': 'export const a = import("./other.js");\n',
    });
    await expect(hookPolicyModule(root)).rejects.toThrow('import-free');
  });
});

describe('syncHookPolicy', () => {
  it('writes once and is then in sync', async () => {
    const root = makeRepo({
      'format.ts': FORMAT,
      'index.ts': ENTRY,
      'policy.ts': POLICY,
      'types.ts': TYPES,
    });
    const target = path.join(root, 'packages', 'agent-plugins', 'hooks', 'lib', 'policy.mjs');
    const first = await syncHookPolicy(root, false);
    expect(first).toHaveLength(1);
    expect(fs.existsSync(target)).toBe(true);
    expect(await syncHookPolicy(root, false)).toEqual([]);
    expect(await syncHookPolicy(root, true)).toEqual([]);
  });
});

describe('real artifact contract', () => {
  const repoRoot = path.resolve(import.meta.dirname, '..');

  it('bundles import-free with the barrel export surface and working guards', async () => {
    const code = await hookPolicyModule(repoRoot);
    expect(code).not.toMatch(/^\s*import\b/mu);
    expect(code).not.toMatch(/\bimport\s*\(/u);
    const { publicNames } = bundleSources(repoRoot);
    expect(code.trimEnd().endsWith(`export { ${publicNames.join(', ')} };`)).toBe(true);
    expect(publicNames).toEqual([
      'ALLOW',
      'strictest',
      'splitCommands',
      'classifyGitSafety',
      'PROTECTED_BRANCH',
      'classifyEnvDump',
      'classifyEmailScan',
      'findEmails',
      'maskEmail',
      'outgoingText',
      'classifyGeneratedEdit',
      'editTargets',
      'generatedMarker',
    ]);

    // The bundled artifact executes: golden vectors through the shipped code.
    const file = path.join(tempDir(), 'policy.mjs');
    fs.writeFileSync(file, `${code}\n`, 'utf-8');
    const policy: unknown = await import(pathToFileURL(file).href);
    if (!isPolicySmoke(policy)) {
      throw new Error('bundled policy exports have an unexpected shape');
    }
    expect(policy.classifyEnvDump('env | grep TOKEN').verdict).toBe('ask');
    expect(policy.classifyEnvDump('printenv HOME').verdict).toBe('allow');
    expect(
      policy.classifyGitSafety('git commit --no-verify -m x', { currentBranch: () => 'feature/x' })
        .verdict,
    ).toBe('block');
  });
});
