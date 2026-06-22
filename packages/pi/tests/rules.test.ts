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

  it('when mode is null, still prepends RULES_CONTENT to the system prompt', () => {
    const state = createInitialState();
    const handler = createBeforeAgentStartHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    expect(result.systemPrompt!).toContain('# Global Agent Rules');
    expect(result.systemPrompt!).toContain('You are an AI assistant.');
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

  it('the returned systemPrompt starts with RULES_CONTENT, then appends existing systemPrompt and mode', () => {
    const state = createInitialState();
    state.mode = 'blitz';
    const handler = createBeforeAgentStartHandler(state);

    const result = handler(baseEvent, {} as any) as BeforeAgentStartEventResult;
    // RULES_CONTENT should come first
    expect(result.systemPrompt!.indexOf('# Global Agent Rules')).toBeLessThan(
      result.systemPrompt!.indexOf('You are an AI assistant.'),
    );
    // Original system prompt should precede mode
    expect(result.systemPrompt!.indexOf('You are an AI assistant.')).toBeLessThan(
      result.systemPrompt!.indexOf('[MODE: blitz]'),
    );
  });
});
