import type { Config, Hooks } from '@opencode-ai/plugin';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { MaestriaPlugin } from '@/index.js';
import {
  appendInstructions,
  formatProjectSection,
  loadProjectSections,
  resolveProjectRoot,
} from '@/project-config.js';
import type { ProjectConfigFs } from '@/project-config.js';
import { RULES_PATH } from '@/root.js';

import { pluginInputForRoot } from './helpers.js';

type SystemTransformHook = NonNullable<Hooks['experimental.chat.system.transform']>;
type SystemTransformInput = Parameters<SystemTransformHook>[0];
type SystemTransformOutput = Parameters<SystemTransformHook>[1];

const makeTempRoot = (): string => mkdtempSync(path.join(tmpdir(), 'maestria-project-'));

const writeProjectFile = (root: string, rel: string, content: string): string => {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
};

const removeRoot = (root: string): void => {
  rmSync(root, { force: true, recursive: true });
};

// The hook under test never reads its input; fabricating a full SDK Model
// value would add no signal, so the input is a minimal stub.
// oxlint-disable-next-line no-unsafe-type-assertion -- test seam only: system.transform ignores its input, and a full SDK Model literal would assert nothing about the hook contract.
const stubTransformInput = (): SystemTransformInput => ({}) as SystemTransformInput;

const stubTransformOutput = (system: string[] = []): SystemTransformOutput => ({ system });

const getSystemTransformHook = (plugin: Hooks): SystemTransformHook => {
  const hook = plugin['experimental.chat.system.transform'];
  if (hook === undefined) {
    throw new Error('Expected experimental.chat.system.transform hook');
  }
  return hook;
};

describe('resolveProjectRoot', () => {
  it('prefers the SDK project worktree over cwd and git worktree', () => {
    expect(
      resolveProjectRoot({
        directory: '/sessions/cwd',
        project: { worktree: '/projects/acme' },
        worktree: '/git/worktree',
      }),
    ).toBe('/projects/acme');
  });

  it('falls back to the git worktree path when no project worktree exists', () => {
    expect(resolveProjectRoot({ directory: '/sessions/cwd', worktree: '/git/worktree' })).toBe(
      '/git/worktree',
    );
  });

  it('falls back to the session directory for non-git projects', () => {
    expect(resolveProjectRoot({ directory: '/sessions/cwd', project: {} })).toBe('/sessions/cwd');
  });

  it('skips the "/" worktree sentinel and uses the session directory', () => {
    expect(
      resolveProjectRoot({
        directory: '/home/user/notes',
        project: { worktree: '/' },
        worktree: '/',
      }),
    ).toBe('/home/user/notes');
  });

  it('skips a sentinel project worktree but keeps a real instance worktree', () => {
    expect(
      resolveProjectRoot({
        directory: '/sessions/cwd',
        project: { worktree: '/' },
        worktree: '/remote/checkout',
      }),
    ).toBe('/remote/checkout');
  });

  it('accepts a genuine "/" session directory instead of rejecting the root', () => {
    expect(resolveProjectRoot({ directory: '/', project: { worktree: '/' } })).toBe('/');
  });

  it('returns undefined when the host provides no usable root', () => {
    expect(resolveProjectRoot({})).toBeUndefined();
  });
});

describe('loadProjectSections', () => {
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

  it('loads a single present file without requiring the other', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
    } finally {
      removeRoot(root);
    }
  });

  it('skips empty files, which carry no instructions', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/workflow.md', '');
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
    } finally {
      removeRoot(root);
    }
  });

  it('sees additions and deletions on the next call (no stale snapshot)', () => {
    const root = makeTempRoot();
    try {
      expect(loadProjectSections(root)).toEqual([]);
      writeProjectFile(root, '.maestria/workflow.md', '# v1\n');
      expect(loadProjectSections(root)).toHaveLength(1);
      writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# v2\n', rel: '.maestria/workflow.md' },
      ]);
    } finally {
      removeRoot(root);
    }
  });

  it('fails loudly when a project path is a directory', () => {
    const root = makeTempRoot();
    try {
      mkdirSync(path.join(root, '.maestria', 'rules.md'), { recursive: true });
      expect(() => loadProjectSections(root)).toThrow(/is a directory/u);
    } finally {
      removeRoot(root);
    }
  });

  it('fails loudly on unreadable files via a deterministic seam (no chmod)', () => {
    const sentinel = 'sentinel-secret-content-4xqz';
    const fs: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => {
        const error = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      },
      resolveLink: (candidate) => candidate,
    };
    let message = '';
    try {
      loadProjectSections('/projects/acme', fs);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/exists but cannot be read/u);
    expect(message).not.toContain(sentinel);
    expect(message).not.toContain('/projects/acme');
  });

  it('fails loudly on special files and on links escaping the project root', () => {
    const special: ProjectConfigFs = {
      kindOf: () => 'other',
      readFile: () => '',
      resolveLink: (candidate) => candidate,
    };
    expect(() => loadProjectSections('/projects/acme', special)).toThrow(/not a regular file/u);

    const escaping: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => 'evil',
      resolveLink: () => path.resolve('/elsewhere/evil.md'),
    };
    expect(() => loadProjectSections('/projects/acme', escaping)).toThrow(
      /outside the project root/u,
    );
  });

  it('sanitizes raw filesystem failures at every seam: no paths, contents, or causes leak', () => {
    const root = '/projects/acme';
    const sentinel = 'sentinel-secret-content-8pld';
    const raw = (what: string): Error => {
      const error = new Error(`${what} ${root}/.maestria/workflow.md: ${sentinel}`);
      (error as NodeJS.ErrnoException).code = 'EACCES';
      return error;
    };
    const cases: { fs: ProjectConfigFs; pattern: RegExp }[] = [
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
    for (const { fs, pattern } of cases) {
      let caught: unknown;
      try {
        loadProjectSections(root, fs);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      // oxlint-disable-next-line no-unsafe-type-assertion -- toBeInstanceOf above establishes Error; the destructured message/cause feed the leak check below.
      const { message, cause } = caught as Error & { cause?: unknown };
      expect(message).toMatch(pattern);
      expect(message).not.toContain(root);
      expect(message).not.toContain(sentinel);
      // The host serializes thrown transform errors: the raw failure must not ride along.
      expect(cause).toBeUndefined();
    }
  });

  it('loads inside-root files through a symlinked root', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'maestria-opencode-root-alias-'));
    try {
      const real = path.join(parent, 'real');
      writeProjectFile(real, '.maestria/workflow.md', '# workflow\n');
      const aliased = path.join(parent, 'aliased');
      symlinkSync(real, aliased);
      expect(loadProjectSections(aliased)).toEqual([
        { content: '# workflow\n', rel: '.maestria/workflow.md' },
      ]);
    } finally {
      removeRoot(parent);
    }
  });

  it('rejects a symlink to a directory inside the root before reading', () => {
    const root = makeTempRoot();
    try {
      const target = path.join(root, '.maestria', 'target-dir');
      mkdirSync(target, { recursive: true });
      symlinkSync(target, path.join(root, '.maestria', 'workflow.md'));
      expect(() => loadProjectSections(root)).toThrow(/is a directory/u);
    } finally {
      removeRoot(root);
    }
  });

  it('accepts links that resolve inside the project root', () => {
    const root = path.resolve('/projects/acme');
    const fs: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => '# linked\n',
      resolveLink: (candidate) => candidate,
    };
    expect(loadProjectSections(root, fs)).toEqual([
      { content: '# linked\n', rel: '.maestria/workflow.md' },
      { content: '# linked\n', rel: '.maestria/rules.md' },
    ]);
  });
});

describe('formatProjectSection', () => {
  it('names the relative file, keeps subordinate status visible, and passes content through', () => {
    const body = '# rules\n- Be careful\n';
    const formatted = formatProjectSection({ content: body, rel: '.maestria/rules.md' });
    expect(formatted).toContain('.maestria/rules.md');
    expect(formatted).toContain('subordinate');
    expect(formatted).toContain(body);
  });
});

describe('appendInstructions', () => {
  it('preserves user entries and appends without duplicates on repeat calls', () => {
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
      writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      const output = stubTransformOutput(['existing system block']);
      const before: string[] = output.system;
      await getSystemTransformHook(plugin)(stubTransformInput(), output);

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

  it('leaves the system array untouched when both files are absent', async () => {
    const root = makeTempRoot();
    try {
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      const output = stubTransformOutput(['existing system block']);
      await getSystemTransformHook(plugin)(stubTransformInput(), output);
      expect(output.system).toEqual(['existing system block']);
    } finally {
      removeRoot(root);
    }
  });

  it('does not accumulate across calls and picks up edits on the next call', async () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/workflow.md', '# v1\n');
      const plugin = await MaestriaPlugin(pluginInputForRoot(root));
      const hook = getSystemTransformHook(plugin);

      const first = stubTransformOutput();
      await hook(stubTransformInput(), first);
      expect(first.system).toHaveLength(1);

      writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
      const second = stubTransformOutput();
      await hook(stubTransformInput(), second);
      expect(second.system).toHaveLength(1);
      expect(second.system[0]).toContain('# v2');
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
        getSystemTransformHook(plugin)(stubTransformInput(), stubTransformOutput()),
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
