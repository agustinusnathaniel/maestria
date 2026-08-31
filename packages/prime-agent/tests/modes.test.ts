import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vite-plus/test';

import { MODE_MARKERS, createModePromptHandler, getModePrompt } from '../src/modes.ts';
import type { ExtensionContext } from '../src/pi-api.ts';
import type { MaestriaModeState } from '../src/state.ts';

// Note: modes.ts keeps a module-level prompt cache keyed by mode keyword, so
// each test below exercises a distinct keyword exactly once. Files are written
// under a temp dir (never the generated skills/) so these tests are
// deterministic and independent of the sync-projected skills on disk.
const tempDirs: string[] = [];
function makeSkillsDir(name: string, keyword: string, skillFile?: string): string {
  const dir = mkdtempSync(join(tmpdir(), `maestria-prime-agent-${name}-`));
  tempDirs.push(dir);
  if (skillFile !== undefined) {
    mkdirSync(join(dir, keyword), { recursive: true });
    writeFileSync(join(dir, keyword, 'SKILL.md'), skillFile, 'utf-8');
  }
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

const SKILL_WITH_MODE_HEADING = [
  '---',
  'name: fein',
  'description: Full pipeline mode.',
  '---',
  '',
  '<!-- Auto-generated from @maestria/core. Do not edit directly. -->',
  '',
  '[MODE: fein]',
  '',
  '## MODE: fein (Full Pipeline)',
  '',
  'Activate the full route.',
  '',
].join('\n');

const SKILL_WITHOUT_MODE_HEADING = [
  '---',
  'name: sonar',
  'description: Research-only mode.',
  '---',
  '',
  'Research-only mode. Load the orchestrator skill.',
  '',
].join('\n');

describe('getModePrompt (mode content from generated skills)', () => {
  it('slices the prompt from the ## MODE: heading onward, prefixed with the marker', () => {
    const dir = makeSkillsDir('has-heading', 'fein', SKILL_WITH_MODE_HEADING);

    const prompt = getModePrompt('fein', dir);

    expect(prompt).toContain('[MODE: fein]');
    expect(prompt).toContain('## MODE: fein (Full Pipeline)');
    expect(prompt).toContain('Activate the full route.');
    // Content before the heading (frontmatter and the auto-generated banner)
    // must not leak into the injected prompt.
    expect(prompt).not.toContain('name: fein');
    expect(prompt).not.toContain('Auto-generated');
  });

  it('returns an empty prompt (and warns) when the skill has no ## MODE: heading', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dir = makeSkillsDir('missing-heading', 'sonar', SKILL_WITHOUT_MODE_HEADING);

    const prompt = getModePrompt('sonar', dir);

    expect(prompt).toBe('');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('no "## MODE:" heading');
  });

  it('returns an empty prompt (and warns) when the skill file is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dir = makeSkillsDir('missing-file', 'blitz');

    const prompt = getModePrompt('blitz', dir);

    expect(prompt).toBe('');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('failed to load mode skill "blitz"');
  });
});

describe('before_agent_start mode prompt injection', () => {
  it('injects nothing when the active mode skill lacks a ## MODE: heading', () => {
    const dir = makeSkillsDir('handler-missing-heading', 'sonar', SKILL_WITHOUT_MODE_HEADING);
    const state: MaestriaModeState = { mode: 'sonar' };
    const handler = createModePromptHandler(state, dir);

    const result = handler(
      { prompt: 'p', systemPrompt: 'BASE SYSTEM PROMPT', type: 'before_agent_start' },
      {} as ExtensionContext,
    );

    // The generated sonar SKILL.md in this dir has no mode section: the whole
    // skill body must not be injected; the handler must leave the prompt
    // untouched.
    expect(result).toBeUndefined();
  });

  it('injects the mode section when the active mode skill has one', () => {
    const dir = makeSkillsDir('handler-with-heading', 'fein', SKILL_WITH_MODE_HEADING);
    const state: MaestriaModeState = { mode: 'fein' };
    const handler = createModePromptHandler(state, dir);

    const result = handler(
      { prompt: 'p', systemPrompt: 'BASE SYSTEM PROMPT', type: 'before_agent_start' },
      {} as ExtensionContext,
    );

    expect(result).toBeDefined();
    const systemPrompt = result!.systemPrompt!;
    expect(systemPrompt.startsWith('BASE SYSTEM PROMPT')).toBe(true);
    expect(systemPrompt).toContain(MODE_MARKERS.fein);
    expect(systemPrompt).toContain('## MODE: fein (Full Pipeline)');
  });
});
