import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createModePromptHandler, getModePrompt, MODE_MARKERS } from '@/modes.ts';
import type { ExtensionContext } from '@/pi-api.ts';
import type { ProjectConfigFs } from '@/project-config.ts';
import type { MaestriaModeState } from '@/state.ts';

// Note: modes.ts keeps a module-level prompt cache keyed by mode keyword, so
// each test below exercises a distinct keyword exactly once. Files are written
// under a temp dir (never the generated skills/) so these tests are
// deterministic and independent of the sync-projected skills on disk.
const tempDirs: string[] = [];
const makeSkillsDir = (name: string, keyword: string, skillFile?: string): string => {
  const dir = mkdtempSync(path.join(tmpdir(), `maestria-prime-agent-${name}-`));
  tempDirs.push(dir);
  if (skillFile !== undefined) {
    mkdirSync(path.join(dir, keyword), { recursive: true });
    writeFileSync(path.join(dir, keyword, 'SKILL.md'), skillFile, 'utf-8');
  }
  return dir;
};

const extensionContext: ExtensionContext = {
  cwd: '/',
  hasUI: true,
  sessionManager: {
    getBranch: () => [],
    getEntries: () => [],
  },
  ui: { notify: () => {}, setEditorText: () => {} },
};

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
      extensionContext,
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
      extensionContext,
    );

    expect(result).toBeDefined();
    if (result?.systemPrompt === undefined) {
      throw new Error('expected a system prompt');
    }
    const { systemPrompt } = result;
    expect(systemPrompt.startsWith('BASE SYSTEM PROMPT')).toBe(true);
    expect(systemPrompt).toContain(MODE_MARKERS.fein);
    expect(systemPrompt).toContain('## MODE: fein (Full Pipeline)');
  });
});

const projectContext = (cwd: string, notify?: (message: string) => void): ExtensionContext => ({
  cwd,
  hasUI: true,
  sessionManager: {
    getBranch: () => [],
    getEntries: () => [],
  },
  ui: {
    notify: (message: string) => {
      notify?.(message);
    },
    setEditorText: () => {},
  },
});

const writeProjectFile = (root: string, rel: string, content: string): void => {
  mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
  writeFileSync(path.join(root, rel), content, 'utf-8');
};

describe('before_agent_start project customization', () => {
  const makeProjectRoot = (): string => {
    const dir = mkdtempSync(path.join(tmpdir(), 'maestria-prime-project-handler-'));
    tempDirs.push(dir);
    return dir;
  };

  it('injects both sections in workflow-then-rules order with no mode active', () => {
    const skillsDir = makeSkillsDir('proj-no-mode', 'blitz');
    const root = makeProjectRoot();
    writeProjectFile(root, '.maestria/rules.md', '# rules\n');
    writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
    const state: MaestriaModeState = { mode: null };
    const handler = createModePromptHandler(state, skillsDir);

    const result = handler(
      { prompt: 'p', systemPrompt: 'BASE SYSTEM PROMPT', type: 'before_agent_start' },
      projectContext(root),
    );

    expect(result).toBeDefined();
    const prompt = result?.systemPrompt ?? '';
    expect(prompt.startsWith('BASE SYSTEM PROMPT')).toBe(true);
    expect(prompt.indexOf('.maestria/workflow.md')).toBeLessThan(
      prompt.indexOf('.maestria/rules.md'),
    );
    expect(prompt).toContain('# workflow');
    expect(prompt).toContain('subordinate');
  });

  it('keeps the mode prompt before project sections', () => {
    const skillsDir = makeSkillsDir('proj-with-mode', 'fein', SKILL_WITH_MODE_HEADING);
    const root = makeProjectRoot();
    writeProjectFile(root, '.maestria/rules.md', '# rules\n');
    const state: MaestriaModeState = { mode: 'fein' };
    const handler = createModePromptHandler(state, skillsDir);

    const result = handler(
      { prompt: 'p', systemPrompt: 'BASE SYSTEM PROMPT', type: 'before_agent_start' },
      projectContext(root),
    );

    const prompt = result?.systemPrompt ?? '';
    expect(prompt).toContain(MODE_MARKERS.fein);
    expect(prompt.indexOf(MODE_MARKERS.fein)).toBeLessThan(prompt.indexOf('.maestria/rules.md'));
  });

  it('picks up edits on the next turn with no stale snapshot', () => {
    const skillsDir = makeSkillsDir('proj-fresh', 'blitz');
    const root = makeProjectRoot();
    writeProjectFile(root, '.maestria/workflow.md', '# v1\n');
    const state: MaestriaModeState = { mode: null };
    const handler = createModePromptHandler(state, skillsDir);

    const first =
      handler(
        { prompt: 'p', systemPrompt: 'BASE', type: 'before_agent_start' },
        projectContext(root),
      )?.systemPrompt ?? '';
    expect(first).toContain('# v1');
    writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
    const second =
      handler(
        { prompt: 'p', systemPrompt: 'BASE', type: 'before_agent_start' },
        projectContext(root),
      )?.systemPrompt ?? '';
    expect(second).toContain('# v2');
    expect(second).not.toContain('# v1');
  });

  it('surfaces a broken project file as a STOP banner plus notify instead of throwing', () => {
    const skillsDir = makeSkillsDir('proj-broken', 'blitz');
    const fs: ProjectConfigFs = {
      kindOf: () => 'directory',
      readFile: () => '',
      resolveLink: (candidate) => candidate,
    };
    const notifications: string[] = [];
    const state: MaestriaModeState = { mode: null };
    let prompt = '';
    expect(() => {
      prompt =
        createModePromptHandler(
          state,
          skillsDir,
          fs,
        )(
          { prompt: 'p', systemPrompt: 'BASE', type: 'before_agent_start' },
          projectContext('/projects/acme', (message) => {
            notifications.push(message);
          }),
        )?.systemPrompt ?? '';
    }).not.toThrow();
    expect(prompt).toContain('STOP');
    expect(prompt).toContain('.maestria/workflow.md');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('.maestria/workflow.md');
  });

  it('surfaces links escaping the project root without leaking the absolute root', () => {
    const skillsDir = makeSkillsDir('proj-escape', 'blitz');
    const fs: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => 'evil',
      resolveLink: () => path.resolve('/elsewhere/evil.md'),
    };
    const state: MaestriaModeState = { mode: null };
    const prompt =
      createModePromptHandler(
        state,
        skillsDir,
        fs,
      )(
        { prompt: 'p', systemPrompt: 'BASE', type: 'before_agent_start' },
        projectContext('/projects/acme'),
      )?.systemPrompt ?? '';
    expect(prompt).toContain('STOP');
    expect(prompt).toMatch(/outside the project root/u);
    expect(prompt).not.toContain('/projects/acme');
  });
});
