import { describe, it, expect } from 'vite-plus/test';
import { createBeforeAgentStartHandler } from '../src/rules.js';
import { createInitialState } from '../src/state.js';
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from '@earendil-works/pi-coding-agent';

describe('createBeforeAgentStartHandler', () => {
  const baseEvent: BeforeAgentStartEvent = {
    type: 'before_agent_start',
    prompt: 'build the feature',
    systemPrompt: 'You are an AI assistant.',
    systemPromptOptions: {} as any,
  };

  it('when mode is null, returns undefined (no-op)', () => {
    const state = createInitialState();
    const handler = createBeforeAgentStartHandler(state);

    const result = handler(baseEvent, {} as any);
    expect(result).toBeUndefined();
  });

  it('when mode is "fein", returns a result with systemPrompt containing the mode marker', () => {
    const state = createInitialState();
    state.mode = 'fein';
    const handler = createBeforeAgentStartHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(result.systemPrompt!).toContain('[MODE: fein]');
  });

  it('when mode is "sonar", returns a result with systemPrompt containing "Research Only"', () => {
    const state = createInitialState();
    state.mode = 'sonar';
    const handler = createBeforeAgentStartHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(result.systemPrompt!).toContain('Research Only');
  });

  it("the returned systemPrompt appends to (rather than replaces) the event's existing systemPrompt", () => {
    const state = createInitialState();
    state.mode = 'blitz';
    const handler = createBeforeAgentStartHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(result.systemPrompt!).toContain('You are an AI assistant.');
    expect(result.systemPrompt!).toContain('[MODE: blitz]');
    expect(result.systemPrompt!.indexOf('You are an AI assistant.')).toBeLessThan(
      result.systemPrompt!.indexOf('[MODE: blitz]'),
    );
  });
});
