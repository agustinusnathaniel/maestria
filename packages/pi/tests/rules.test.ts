import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vite-plus/test';

import { createModePromptHandler } from '@/rules.js';
import { createInitialState } from '@/state.js';

const getSystemPrompt = (result: BeforeAgentStartEventResult): string => {
  if (result.systemPrompt === undefined) {
    throw new Error('Mode prompt handler did not return a system prompt');
  }
  return result.systemPrompt;
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
