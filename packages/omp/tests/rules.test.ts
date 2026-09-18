import type { BeforeAgentStartEvent } from '@oh-my-pi/pi-coding-agent';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createModePromptHandler } from '@/rules.js';
import type { ProjectConfigFs } from '@maestria/shared-pi/project-config';
import { createInitialState } from '@maestria/shared-pi/state-core';

const makeTempRoot = (): string => mkdtempSync(path.join(tmpdir(), 'maestria-omp-rules-'));

const writeProjectFile = (root: string, rel: string, content: string): void => {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
};

const joined = (systemPrompt: string[] | undefined): string => {
  if (!systemPrompt) {
    throw new Error('Expected a system prompt');
  }
  expect(Array.isArray(systemPrompt)).toBe(true);
  return systemPrompt.join('\n');
};

describe('createModePromptHandler', () => {
  // In omp, systemPrompt is a string array (string[]), not a single string.
  const baseEvent: BeforeAgentStartEvent = {
    prompt: 'build the feature',
    systemPrompt: ['You are an AI assistant.'],
    type: 'before_agent_start',
  };

  it('when mode is null, returns void (no modification)', () => {
    const state = createInitialState();
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    expect(result).toBeUndefined();
  });

  it('when mode is "fein", returns a result with systemPrompt containing the mode marker', () => {
    const state = createInitialState();
    state.mode = 'fein';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    if (!result?.systemPrompt) {
      throw new Error('Expected a system prompt');
    }
    expect(Array.isArray(result.systemPrompt)).toBe(true);
    const text = result.systemPrompt.join('\n');
    expect(text).toContain('[MODE: fein]');
  });

  it('when mode is "sonar", returns a result with systemPrompt containing "Research Only"', () => {
    const state = createInitialState();
    state.mode = 'sonar';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    if (!result?.systemPrompt) {
      throw new Error('Expected a system prompt');
    }
    expect(Array.isArray(result.systemPrompt)).toBe(true);
    const text = result.systemPrompt.join('\n');
    expect(text).toContain('Research Only');
  });

  it('the returned systemPrompt array starts with original systemPrompt entries, followed by the mode prompt', () => {
    const state = createInitialState();
    state.mode = 'blitz';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {});
    if (!result?.systemPrompt) {
      throw new Error('Expected a system prompt');
    }
    const promptArray = result.systemPrompt;
    // Original system prompt should come first (the first element is the original string)
    expect(promptArray[0]).toBe('You are an AI assistant.');
    // Mode marker should appear somewhere in the joined string
    const text = promptArray.join('\n');
    expect(text).toContain('[MODE: blitz]');
  });
});

describe('createModePromptHandler project customization', () => {
  const baseEvent: BeforeAgentStartEvent = {
    prompt: 'build the feature',
    systemPrompt: ['You are an AI assistant.'],
    type: 'before_agent_start',
  };

  it('leaves the prompt unchanged when both project files are absent', () => {
    const root = makeTempRoot();
    try {
      const state = createInitialState();
      expect(createModePromptHandler(state)(baseEvent, { cwd: root })).toBeUndefined();
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
      const result = createModePromptHandler(state)(baseEvent, { cwd: root });
      const text = joined(result?.systemPrompt);
      expect(result?.systemPrompt?.[0]).toBe('You are an AI assistant.');
      const workflowAt = text.indexOf('.maestria/workflow.md');
      const rulesAt = text.indexOf('.maestria/rules.md');
      expect(workflowAt).toBeGreaterThan(-1);
      expect(rulesAt).toBeGreaterThan(workflowAt);
      expect(text).toContain('# workflow');
      expect(text).toContain('# rules');
      expect(text).toContain('subordinate');
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('keeps the mode prompt before project sections', () => {
    const root = makeTempRoot();
    try {
      writeProjectFile(root, '.maestria/rules.md', '# rules\n');
      const state = createInitialState();
      state.mode = 'fein';
      const text = joined(createModePromptHandler(state)(baseEvent, { cwd: root })?.systemPrompt);
      expect(text.indexOf('[MODE: fein]')).toBeLessThan(text.indexOf('.maestria/rules.md'));
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
      expect(joined(handler(baseEvent, { cwd: first })?.systemPrompt)).toContain('# first-root');
      expect(joined(handler(baseEvent, { cwd: second })?.systemPrompt)).toContain('# second-root');
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
      expect(joined(handler(baseEvent, { cwd: root })?.systemPrompt)).toContain('# v1');
      writeProjectFile(root, '.maestria/workflow.md', '# v2\n');
      const text = joined(handler(baseEvent, { cwd: root })?.systemPrompt);
      expect(text).toContain('# v2');
      expect(text).not.toContain('# v1');
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
    let text = '';
    expect(() => {
      text = joined(
        createModePromptHandler(state, fs)(baseEvent, { cwd: '/projects/acme', ui: { notify } })
          ?.systemPrompt,
      );
    }).not.toThrow();
    expect(text).toContain('STOP');
    expect(text).toContain('.maestria/workflow.md');
    expect(text).toContain('is a directory');
    expect(notify).toHaveBeenCalledOnce();
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
    const text = joined(
      createModePromptHandler(state, fs)(baseEvent, { cwd: '/projects/acme', ui: { notify } })
        ?.systemPrompt,
    );
    expect(text).toContain('STOP');
    expect(text).toMatch(/cannot be read/u);
    expect(text).not.toContain('/projects/acme');
    expect(notify).toHaveBeenCalledOnce();
  });

  it('surfaces links escaping the project root as a STOP banner', () => {
    const fs: ProjectConfigFs = {
      kindOf: () => 'file',
      readFile: () => 'evil',
      resolveLink: () => path.resolve('/elsewhere/evil.md'),
    };
    const state = createInitialState();
    const text = joined(
      createModePromptHandler(state, fs)(baseEvent, { cwd: '/projects/acme' })?.systemPrompt,
    );
    expect(text).toContain('STOP');
    expect(text).toMatch(/outside the project root/u);
  });
});
