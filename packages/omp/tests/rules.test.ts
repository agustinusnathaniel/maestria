import { describe, it, expect } from 'vite-plus/test';
import { createModePromptHandler } from '@/rules.js';
import { createInitialState } from '@/state.js';
import type { BeforeAgentStartEvent, BeforeAgentStartEventResult } from '@oh-my-pi/pi-coding-agent';

describe('createModePromptHandler', () => {
  // In omp, systemPrompt is a string array (string[]), not a single string.
  const baseEvent: BeforeAgentStartEvent = {
    type: 'before_agent_start',
    prompt: 'build the feature',
    systemPrompt: ['You are an AI assistant.'],
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
    // result.systemPrompt should be a string array
    expect(Array.isArray(result.systemPrompt)).toBe(true);
    const joined = (result.systemPrompt as string[]).join('\n');
    expect(joined).toContain('[MODE: fein]');
  });

  it('when mode is "sonar", returns a result with systemPrompt containing "Research Only"', () => {
    const state = createInitialState();
    state.mode = 'sonar';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(Array.isArray(result.systemPrompt)).toBe(true);
    const joined = (result.systemPrompt as string[]).join('\n');
    expect(joined).toContain('Research Only');
  });

  it('the returned systemPrompt array starts with original systemPrompt entries, followed by the mode prompt', () => {
    const state = createInitialState();
    state.mode = 'blitz';
    const handler = createModePromptHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    const promptArray = result.systemPrompt as string[];
    // Original system prompt should come first (the first element is the original string)
    expect(promptArray[0]).toBe('You are an AI assistant.');
    // Mode marker should appear somewhere in the joined string
    const joined = promptArray.join('\n');
    expect(joined).toContain('[MODE: blitz]');
  });
});
