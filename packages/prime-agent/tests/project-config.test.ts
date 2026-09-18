import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import {
  formatProjectErrorBanner,
  formatProjectSection,
  loadProjectSections,
  PROJECT_CONFIG_REL_PATHS,
} from '@/project-config.ts';
import type { ProjectConfigFs } from '@/project-config.ts';

const makeTempRoot = (): string => mkdtempSync(path.join(tmpdir(), 'maestria-prime-project-'));

const writeProjectFile = (root: string, rel: string, content: string): void => {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf-8');
};

describe('prime project-config scope contract', () => {
  it('loads workflow then rules in deterministic order', () => {
    expect([...PROJECT_CONFIG_REL_PATHS]).toEqual(['.maestria/workflow.md', '.maestria/rules.md']);
  });

  it('returns empty when both project files are absent', () => {
    const root = makeTempRoot();
    try {
      expect(loadProjectSections(root)).toEqual([]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('reads both files in workflow-then-rules order', () => {
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

  it('skips empty files and sees edits on the next call', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/workflow.md', '');
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      expect(loadProjectSections(root)).toEqual([
        { content: '# rules\n', rel: '.maestria/rules.md' },
      ]);
      writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
      expect(loadProjectSections(root)).toHaveLength(2);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('fails loudly on directories, special files, escapes, and unreadable files', () => {
    const root = makeTempRoot();
    try {
      mkdirSync(path.join(root, '.maestria', 'rules.md'), { recursive: true });
      expect(() => loadProjectSections(root)).toThrow(/is a directory/u);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }

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

    const unreadable: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => {
        throw new Error('EACCES: permission denied');
      },
      resolveLink: (candidate) => candidate,
    };
    let message = '';
    try {
      loadProjectSections('/projects/acme', unreadable);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/cannot be read/u);
    expect(message).not.toContain('/projects/acme');
  });

  it('sanitizes raw filesystem failures at every seam: no paths, contents, or causes leak', () => {
    const root = '/projects/acme';
    const sentinel = 'sentinel-secret-content-2vnm';
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
        pattern: /cannot be read/u,
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
      // Hosts serialize thrown errors: the raw failure must not ride along.
      expect(cause).toBeUndefined();
    }
  });

  it('loads inside-root files through a symlinked root', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'maestria-prime-root-alias-'));
    try {
      const real = path.join(parent, 'real');
      writeProjectFile(real, '.maestria/workflow.md', '# workflow\n');
      const aliased = path.join(parent, 'aliased');
      symlinkSync(real, aliased);
      expect(loadProjectSections(aliased)).toEqual([
        { content: '# workflow\n', rel: '.maestria/workflow.md' },
      ]);
    } finally {
      rmSync(parent, { force: true, recursive: true });
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
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('formats sections with subordinate status and error banners with STOP', () => {
    const formatted = formatProjectSection({ content: '# r\n', rel: '.maestria/rules.md' });
    expect(formatted).toContain('.maestria/rules.md');
    expect(formatted).toContain('subordinate');
    expect(formatted).toContain('# r');
    expect(formatProjectErrorBanner('[maestria] broken')).toContain('STOP');
  });
});
