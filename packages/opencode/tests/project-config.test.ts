import type { Config, Hooks } from '@opencode-ai/plugin';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { MaestriaPlugin } from '@/index.js';
import {
  appendInstructions,
  formatProjectSection,
  loadProjectSections,
  resolveProjectRoot,
} from '@/project-config.js';
import type { ProjectConfigFs, ProjectRootInput } from '@/project-config.js';
import { RULES_PATH } from '@/root.js';

import { makeTempRoot, pluginInputForRoot, removeRoot, writeProjectFile } from './helpers.js';

type SystemTransformHook = NonNullable<Hooks['experimental.chat.system.transform']>;
type SystemTransformInput = Parameters<SystemTransformHook>[0];
type SystemTransformOutput = Parameters<SystemTransformHook>[1];

// The hook never reads its input, so one shared stub covers every call.
// oxlint-disable-next-line no-unsafe-type-assertion -- test seam only: a full SDK Model literal would assert nothing about the hook contract.
const transformInput = {} as SystemTransformInput;

const stubTransformOutput = (system: string[] = []): SystemTransformOutput => ({ system });

const getSystemTransformHook = (plugin: Hooks): SystemTransformHook => {
  const hook = plugin['experimental.chat.system.transform'];
  if (hook === undefined) {
    throw new Error('Expected experimental.chat.system.transform hook');
  }
  return hook;
};

describe('resolveProjectRoot', () => {
  const cases: { input: ProjectRootInput; expected: string | undefined; name: string }[] = [
    {
      expected: '/projects/acme',
      input: {
        directory: '/sessions/cwd',
        project: { worktree: '/projects/acme' },
        worktree: '/git/worktree',
      },
      name: 'prefers the SDK project worktree over cwd and git worktree',
    },
    {
      expected: '/git/worktree',
      input: { directory: '/sessions/cwd', worktree: '/git/worktree' },
      name: 'falls back to the git worktree path when no project worktree exists',
    },
    {
      expected: '/sessions/cwd',
      input: { directory: '/sessions/cwd', project: {} },
      name: 'falls back to the session directory for non-git projects',
    },
    {
      expected: '/home/user/notes',
      input: { directory: '/home/user/notes', project: { worktree: '/' }, worktree: '/' },
      name: 'skips the "/" worktree sentinel and uses the session directory',
    },
    {
      expected: '/remote/checkout',
      input: {
        directory: '/sessions/cwd',
        project: { worktree: '/' },
        worktree: '/remote/checkout',
      },
      name: 'skips a sentinel project worktree but keeps a real instance worktree',
    },
    {
      expected: '/',
      input: { directory: '/', project: { worktree: '/' } },
      name: 'accepts a genuine "/" session directory instead of rejecting the root',
    },
    {
      expected: undefined,
      input: {},
      name: 'returns undefined when the host provides no usable root',
    },
  ];
  for (const { input, expected, name } of cases) {
    it(name, () => {
      expect(resolveProjectRoot(input)).toBe(expected);
    });
  }
});

describe('loadProjectSections (thin adapter: order passthrough plus redaction)', () => {
  it('returns empty when both project files are absent', () => {
    const root = makeTempRoot();
    try {
      expect(loadProjectSections(root)).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });

  it('reads both files in deterministic workflow-then-rules order', () => {
    const root = makeTempRoot();
    try {
      // Create in reverse order to prove ordering comes from the contract, not creation time.
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# workflow\n', rel: '.maestria/workflow.md' },
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
    } finally {
      removeRoot(root);
    }
  });

  it('fails loudly with sanitized diagnostics: no paths, contents, or causes leak', () => {
    const root = makeTempRoot();
    try {
      mkdirSync(path.join(root, '.maestria', 'rules.md'), { recursive: true });
      expect(() => loadProjectSections(root)).toThrow(/is a directory/u);
    } finally {
      removeRoot(root);
    }
    const projectRoot = '/projects/acme';
    const sentinel = 'sentinel-secret-content-8pld';
    const raw = (what: string): Error =>
      Object.assign(new Error(`${what} ${projectRoot}/.maestria/workflow.md: ${sentinel}`), {
        code: 'EACCES',
      });
    const table: { fs: ProjectConfigFs; pattern: RegExp }[] = [
      {
        fs: { kindOf: () => 'other', readFile: () => '', resolveLink: (c) => c },
        pattern: /not a regular file/u,
      },
      {
        fs: {
          kindOf: () => 'file',
          readFile: () => 'evil',
          resolveLink: () => path.resolve('/elsewhere/evil.md'),
        },
        pattern: /outside the project root/u,
      },
      {
        fs: {
          kindOf: () => {
            throw raw('lstat failed on');
          },
          readFile: () => '',
          resolveLink: (candidate) => candidate,
        },
        pattern: /cannot be accessed/u,
      },
      {
        fs: {
          kindOf: () => 'file',
          readFile: () => '',
          resolveLink: () => {
            throw raw('realpath failed on');
          },
        },
        pattern: /cannot be resolved/u,
      },
      {
        fs: {
          kindOf: () => 'file',
          readFile: () => {
            throw raw('read failed on');
          },
          resolveLink: (candidate) => candidate,
        },
        pattern: /exists but cannot be read/u,
      },
    ];
    for (const { fs, pattern } of table) {
      let caught: unknown;
      try {
        loadProjectSections(projectRoot, fs);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      // oxlint-disable-next-line no-unsafe-type-assertion -- toBeInstanceOf above establishes Error; the destructured message/cause feed the leak check below.
      const { message, cause } = caught as Error & { cause?: unknown };
      expect(message).toMatch(pattern);
      expect(message).not.toContain(projectRoot);
      expect(message).not.toContain(sentinel);
      // The host serializes thrown transform errors: the raw failure must not ride along.
      expect(cause).toBeUndefined();
    }
  });
});

describe('formatProjectSection and appendInstructions', () => {
  it('names the rel file with subordinate status and merges without duplicates', () => {
    const body = '# rules\n- Be careful\n';
    const formatted = formatProjectSection({ content: body, rel: '.maestria/rules.md' });
    expect(formatted).toContain('.maestria/rules.md');
    expect(formatted).toContain('subordinate');
    expect(formatted).toContain(body);
    const once = appendInstructions(['user.md'], ['a.md', 'b.md']);
    expect(once).toEqual(['user.md', 'a.md', 'b.md']);
    expect(appendInstructions(once, ['a.md', 'b.md'])).toEqual(['user.md', 'a.md', 'b.md']);
  });
});

describe('MaestriaPlugin project content', () => {
  it('keeps project paths out of config instructions and preserves user order', async () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      const config: Config = { agent: {}, instructions: ['user.md'] };
      await plugin.config?.(config);
      expect(config.instructions).toEqual(['user.md', RULES_PATH]);

      // Repeat config calls must not accumulate duplicates.
      await plugin.config?.(config);
      expect(config.instructions).toEqual(['user.md', RULES_PATH]);
    } finally {
      removeRoot(root);
    }
  });

  it('injects both sections in place, preserving existing system entries', async () => {
    const root = makeTempRoot();
    try {
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      const output = stubTransformOutput(['existing system block']);
      const before: string[] = output.system;
      await getSystemTransformHook(plugin)(transformInput, output);
      expect(output.system).toEqual(['existing system block']);

      writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      await getSystemTransformHook(plugin)(transformInput, output);

      // In-place mutation of the same array the host passed in.
      expect(output.system).toBe(before);
      expect(output.system).toHaveLength(3);
      expect(output.system[0]).toBe('existing system block');
      expect(output.system[1]).toContain('.maestria/workflow.md');
      expect(output.system[1]).toContain('# workflow');
      expect(output.system[2]).toContain('.maestria/rules.md');
      expect(output.system[2]).toContain('# rules');
    } finally {
      removeRoot(root);
    }
  });

  it('rejects the model call when a project file is unusable, while init still succeeds', async () => {
    const root = makeTempRoot();
    try {
      mkdirSync(path.join(root, '.maestria', 'rules.md'), { recursive: true });
      // Init must not throw: the host swallows factory errors, so failing
      // here would silently disable the whole plugin.
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      await expect(
        getSystemTransformHook(plugin)(transformInput, stubTransformOutput()),
      ).rejects.toThrow(/is a directory/u);
    } finally {
      removeRoot(root);
    }
  });

  it('adds a project preservation note to compaction context', async () => {
    const root = makeTempRoot();
    try {
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      const output = { context: [] as string[] };
      await plugin['experimental.session.compacting']?.({ sessionID: 's' }, output);
      expect(output.context).toHaveLength(2);
      expect(output.context[1]).toContain('.maestria/');
    } finally {
      removeRoot(root);
    }
  });
});
