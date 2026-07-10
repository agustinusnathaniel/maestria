import { describe, it, expect } from 'vite-plus/test';
import { createModePromptHandler } from '@/rules.js';
import { createInitialState } from '@/state.js';
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';

describe('createModePromptHandler', () => {
  const baseEvent: BeforeAgentStartEvent = {
    type: 'before_agent_start',
    prompt: 'build the feature',
    systemPrompt: 'You are an AI assistant.',
    systemPromptOptions: {} as any,
  };

  it('when mode is null, returns void (no modification)', () => {
    const state = createInitialState();
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {} as any);
    expect(result).toBeUndefined();
  });

  it('when mode is "fein", returns a result with systemPrompt containing the mode marker', () => {
    const state = createInitialState();
    state.mode = 'fein';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(result.systemPrompt!).toContain('[MODE: fein]');
  });

  it('when mode is "sonar", returns a result with systemPrompt containing "Research Only"', () => {
    const state = createInitialState();
    state.mode = 'sonar';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(result.systemPrompt!).toContain('Research Only');
  });

  it('the returned systemPrompt starts with original systemPrompt, followed by the mode prompt', () => {
    const state = createInitialState();
    state.mode = 'blitz';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    // Original system prompt should come first
    expect(result.systemPrompt!.startsWith('You are an AI assistant.')).toBe(true);
    // Mode prompt should follow
    expect(result.systemPrompt!.indexOf('[MODE: blitz]')).toBeGreaterThan(
      result.systemPrompt!.indexOf('You are an AI assistant.'),
    );
  });
});
