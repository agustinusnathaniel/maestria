import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { deploySpecialistAgents } from '../src/agent-deployment.js';
import { ALLOWED_AGENTS } from '../src/subagent-utils.js';

describe('deploySpecialistAgents', () => {
  let root: string;
  let src: string;
  let dest: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'maestria-deploy-'));
    src = path.join(root, 'agents');
    dest = path.join(root, 'target');
    mkdirSync(src, { recursive: true });
    for (const name of ALLOWED_AGENTS) {
      writeFileSync(path.join(src, `${name}.md`), `# ${name}\n`, 'utf-8');
    }
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { force: true, recursive: true });
  });

  it('deploys every bundled agent and creates the target directory', () => {
    const deployed = deploySpecialistAgents(src, dest);

    expect(deployed).toBe(ALLOWED_AGENTS.length);
    for (const name of ALLOWED_AGENTS) {
      expect(readFileSync(path.join(dest, `${name}.md`), 'utf-8')).toBe(`# ${name}\n`);
    }
  });

  it('never overwrites existing agent files', () => {
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(dest, 'builder.md'), 'custom content', 'utf-8');

    const deployed = deploySpecialistAgents(src, dest);

    expect(deployed).toBe(ALLOWED_AGENTS.length - 1);
    expect(readFileSync(path.join(dest, 'builder.md'), 'utf-8')).toBe('custom content');
  });

  it('returns 0 and warns when the source directory is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missingSrc = path.join(root, 'missing');

    expect(deploySpecialistAgents(missingSrc, dest)).toBe(0);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Agents source directory not found'),
      missingSrc,
    );
    expect(existsSync(dest)).toBe(false);
  });

  it('skips missing agent files and deploys the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rmSync(path.join(src, 'builder.md'));

    const deployed = deploySpecialistAgents(src, dest);

    expect(deployed).toBe(ALLOWED_AGENTS.length - 1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('builder.md'));
    expect(existsSync(path.join(dest, 'builder.md'))).toBe(false);
    expect(existsSync(path.join(dest, 'architect.md'))).toBe(true);
  });
});
