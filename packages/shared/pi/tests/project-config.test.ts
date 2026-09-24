import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vite-plus/test';

import { readProjectRoot, tryLoadProjectSections } from '@/project-config.js';

describe('Pi-family project customization wrapper', () => {
  it('uses the session cwd and skips absent host roots', () => {
    expect(readProjectRoot({ cwd: '/projects/acme' })).toBe('/projects/acme');
    expect(readProjectRoot({ cwd: '' })).toBeUndefined();
    expect(readProjectRoot({ cwd: 42 })).toBeUndefined();
    expect(tryLoadProjectSections({})).toEqual({ errorMessage: undefined, sections: [] });
  });

  it('loads fresh content from the session cwd', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'maestria-shared-pi-wrapper-'));
    try {
      mkdirSync(path.join(root, '.maestria'));
      writeFileSync(path.join(root, '.maestria', 'workflow.md'), '# workflow\n');
      expect(tryLoadProjectSections({ cwd: root })).toEqual({
        errorMessage: undefined,
        sections: [{ content: '# workflow\n', rel: '.maestria/workflow.md' }],
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('reports loader failure through notify and the returned error without throwing', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'maestria-shared-pi-wrapper-'));
    const notify = vi.fn<(message: string) => void>();
    try {
      mkdirSync(path.join(root, '.maestria', 'rules.md'), { recursive: true });
      const result = tryLoadProjectSections({ cwd: root, ui: { notify } });
      expect(result.sections).toEqual([]);
      expect(result.errorMessage).toContain('is a directory');
      expect(notify).toHaveBeenCalledWith(result.errorMessage);
      expect(() =>
        tryLoadProjectSections({
          cwd: root,
          ui: {
            notify: () => {
              throw new Error('UI closed');
            },
          },
        }),
      ).not.toThrow();
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
