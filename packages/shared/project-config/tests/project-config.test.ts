import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { formatProjectErrorBanner, formatProjectSection, loadProjectSections } from '@/index.js';
import type { ProjectConfigFs } from '@/index.js';

const makeTempRoot = (): string =>
  mkdtempSync(path.join(tmpdir(), 'maestria-shared-project-config-'));

const writeProjectFile = (root: string, rel: string, content: string): void => {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
};

describe('project-config scope contract', () => {
  it('returns empty when both project files are absent', () => {
    const root = makeTempRoot();
    try {
      expect(loadProjectSections(root)).toEqual([]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
    expect(loadProjectSections('')).toEqual([]);
  });

  it('reads both files in workflow-then-rules order regardless of creation order', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# workflow\n', rel: '.maestria/workflow.md' },
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('loads a single present file, skips empty, and sees edits fresh', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/workflow.md', '');
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
      writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# v2\n', rel: '.maestria/workflow.md' },
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('fails loudly when a project path is a directory', () => {
    const root = makeTempRoot();
    try {
      mkdirSync(path.join(root, '.maestria', 'rules.md'), { recursive: true });
      expect(() => loadProjectSections(root)).toThrow(/is a directory/u);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('fails loudly with sanitized diagnostics: no paths, contents, or causes leak', () => {
    const root = '/projects/acme';
    const sentinel = 'sentinel-secret-content-7kqw';
    const raw = (what: string): Error =>
      Object.assign(new Error(`${what} ${root}/.maestria/workflow.md: ${sentinel}`), {
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
          kindOf: () => 'file',
          readFile: () => 'x',
          resolveLink: () => {
            throw new Error('ENOENT: dangling link');
          },
        },
        pattern: /cannot be resolved/u,
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
      // Hosts serialize thrown errors: the raw failure must not ride along.
      expect(cause).toBeUndefined();
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

  it('follows a symlinked root but rejects a symlink to a directory', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'maestria-shared-project-config-root-alias-'));
    try {
      const real = path.join(parent, 'real');
      mkdirSync(path.join(real, '.maestria'), { recursive: true });
      writeFileSync(path.join(real, '.maestria', 'workflow.md'), '# workflow\n');
      const aliased = path.join(parent, 'aliased');
      symlinkSync(real, aliased);
      expect(loadProjectSections(aliased)).toEqual([
        { content: '# workflow\n', rel: '.maestria/workflow.md' },
      ]);
    } finally {
      rmSync(parent, { force: true, recursive: true });
    }

    const root = makeTempRoot();
    try {
      const target = path.join(root, '.maestria', 'target-dir');
      mkdirSync(target, { recursive: true });
      symlinkSync(target, path.join(root, '.maestria', 'workflow.md'));
      expect(() => loadProjectSections(root)).toThrow(/is a directory/u);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('rejects escaping and dangling file symlinks with relative diagnostics', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'maestria-project-link-'));
    try {
      const root = path.join(parent, 'project');
      const configDir = path.join(root, '.maestria');
      mkdirSync(configDir, { recursive: true });
      const outside = path.join(parent, 'outside.md');
      writeFileSync(outside, '# outside\n');
      const workflow = path.join(configDir, 'workflow.md');
      symlinkSync(outside, workflow);
      expect(() => loadProjectSections(root)).toThrow(
        '[maestria] Project config ".maestria/workflow.md" resolves outside the project root',
      );
      rmSync(workflow);
      symlinkSync(path.join(parent, 'missing.md'), workflow);
      expect(() => loadProjectSections(root)).toThrow(
        '[maestria] Project config ".maestria/workflow.md" cannot be resolved',
      );
    } finally {
      rmSync(parent, { force: true, recursive: true });
    }
  });
});

describe('project-config formatting', () => {
  it('names the rel file with subordinate status, and banners carry STOP', () => {
    const body = '# rules\n- Be careful\n';
    const formatted = formatProjectSection({ content: body, rel: '.maestria/rules.md' });
    expect(formatted).toContain('.maestria/rules.md');
    expect(formatted).toContain('subordinate');
    expect(formatted).toContain(body);
    const banner = formatProjectErrorBanner(
      '[maestria] Project config ".maestria/rules.md" is a directory',
    );
    expect(banner).toContain('STOP');
    expect(banner).toContain('.maestria/rules.md');
  });
});
