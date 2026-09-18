import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createModePromptHandler } from '@/rules.js';
import type { ProjectConfigFs } from '@maestria/shared-pi/project-config';
import { createInitialState } from '@maestria/shared-pi/state-core';

const getSystemPrompt = (result: BeforeAgentStartEventResult): string => {
  if (result.systemPrompt === undefined) {
    throw new Error('Mode prompt handler did not return a system prompt');
  }
  return result.systemPrompt;
};

const makeTempRoot = (): string => mkdtempSync(path.join(tmpdir(), 'maestria-pi-rules-'));

const writeProjectFile = (root: string, rel: string, content: string): void => {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
};

describe('createModePromptHandler', () => {
  const baseEvent: BeforeAgentStartEvent = {
    prompt: 'build the feature',
    systemPrompt: 'You are an AI assistant.',
    systemPromptOptions: { cwd: '' },
    type: 'before_agent_start',
  };
  it('when mode is null, returns an empty result (no modification)', () => {
    const state = createInitialState();
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    expect(result).toEqual({});
  });

  it('when mode is "fein", returns a result with systemPrompt containing the mode marker', () => {
    const state = createInitialState();
    state.mode = 'fein';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    expect(getSystemPrompt(result)).toContain('[MODE: fein]');
  });

  it('when mode is "sonar", returns a result with systemPrompt containing "Research Only"', () => {
    const state = createInitialState();
    state.mode = 'sonar';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    expect(getSystemPrompt(result)).toContain('Research Only');
  });

  it('the returned systemPrompt starts with original systemPrompt, followed by the mode prompt', () => {
    const state = createInitialState();
    state.mode = 'blitz';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    // Original system prompt should come first
    expect(getSystemPrompt(result).startsWith('You are an AI assistant.')).toBe(true);
    // Mode prompt should follow
    expect(getSystemPrompt(result).indexOf('[MODE: blitz]')).toBeGreaterThan(
      getSystemPrompt(result).indexOf('You are an AI assistant.'),
    );
  });
});

describe('createModePromptHandler project customization', () => {
  const baseEvent: BeforeAgentStartEvent = {
    prompt: 'build the feature',
    systemPrompt: 'You are an AI assistant.',
    systemPromptOptions: { cwd: '' },
    type: 'before_agent_start',
  };

  it('leaves the prompt unchanged when both project files are absent', () => {
    const root = makeTempRoot();
    try {
      const state = createInitialState();
      const result = createModePromptHandler(state)(baseEvent, { cwd: root });
      expect(result).toEqual({});
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('injects both sections in workflow-then-rules order with no mode active', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      writeProjectFile(root, '.maestria/workflow.md', '# workflow\n');
      const state = createInitialState();
      const prompt = getSystemPrompt(createModePromptHandler(state)(baseEvent, { cwd: root }));
      expect(prompt.startsWith('You are an AI assistant.')).toBe(true);
      const workflowAt = prompt.indexOf('.maestria/workflow.md');
      const rulesAt = prompt.indexOf('.maestria/rules.md');
      expect(workflowAt).toBeGreaterThan(-1);
      expect(rulesAt).toBeGreaterThan(workflowAt);
      expect(prompt).toContain('# workflow');
      expect(prompt).toContain('# rules');
      expect(prompt).toContain('subordinate');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('keeps the mode prompt before project sections and preserves the base prompt', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      const state = createInitialState();
      state.mode = 'fein';
      const prompt = getSystemPrompt(createModePromptHandler(state)(baseEvent, { cwd: root }));
      expect(prompt.startsWith('You are an AI assistant.')).toBe(true);
      expect(prompt.indexOf('[MODE: fein]')).toBeLessThan(prompt.indexOf('.maestria/rules.md'));
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('scopes reads to ctx.cwd: different session directories give different content', () => {
    const first = makeTempRoot();
    const second = makeTempRoot();
    try {
      writeProjectFile(first, '.maestria/rules.md', '# first-root\n');
      writeProjectFile(second, '.maestria/rules.md', '# second-root\n');
      const state = createInitialState();
      const handler = createModePromptHandler(state);
      expect(getSystemPrompt(handler(baseEvent, { cwd: first }))).toContain('# first-root');
      expect(getSystemPrompt(handler(baseEvent, { cwd: second }))).toContain('# second-root');
    } finally {
      rmSync(first, { force: true, recursive: true });
      rmSync(second, { force: true, recursive: true });
    }
  });

  it('picks up edits on the next turn with no stale snapshot', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/workflow.md', '# v1\n');
      const state = createInitialState();
      const handler = createModePromptHandler(state);
      expect(getSystemPrompt(handler(baseEvent, { cwd: root }))).toContain('# v1');
      writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
      const prompt = getSystemPrompt(handler(baseEvent, { cwd: root }));
      expect(prompt).toContain('# v2');
      expect(prompt).not.toContain('# v1');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('surfaces a directory entry as a STOP banner plus notify instead of throwing', () => {
    const fs: ProjectConfigFs = {
      kindOf: () => 'directory',
      readFile: () => '',
      resolveLink: (candidate) => candidate,
    };
    const notify = vi.fn<(message: string) => void>();
    const state = createInitialState();
    let prompt = '';
    expect(() => {
      prompt = getSystemPrompt(
        createModePromptHandler(state, fs)(baseEvent, { cwd: '/projects/acme', ui: { notify } }),
      );
    }).not.toThrow();
    expect(prompt).toContain('STOP');
    expect(prompt).toContain('.maestria/workflow.md');
    expect(prompt).toContain('is a directory');
    expect(notify).toHaveBeenCalledOnce();
    expect(notify.mock.calls[0]?.[0]).toContain('.maestria/workflow.md');
  });

  it('surfaces unreadable files via a deterministic seam, leaking neither content nor absolute root', () => {
    const fs: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => {
        const error = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      },
      resolveLink: (candidate) => candidate,
    };
    const notify = vi.fn<(message: string) => void>();
    const state = createInitialState();
    const prompt = getSystemPrompt(
      createModePromptHandler(state, fs)(baseEvent, { cwd: '/projects/acme', ui: { notify } }),
    );
    expect(prompt).toContain('STOP');
    expect(prompt).toMatch(/cannot be read/u);
    expect(prompt).not.toContain('/projects/acme');
    expect(notify).toHaveBeenCalledOnce();
  });

  it('surfaces links escaping the project root as a STOP banner', () => {
    const fs: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => 'evil',
      resolveLink: () => path.resolve('/elsewhere/evil.md'),
    };
    const state = createInitialState();
    const prompt = getSystemPrompt(
      createModePromptHandler(state, fs)(baseEvent, { cwd: '/projects/acme' }),
    );
    expect(prompt).toContain('STOP');
    expect(prompt).toMatch(/outside the project root/u);
  });
});
