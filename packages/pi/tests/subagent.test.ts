import { describe, it, expect, vi } from 'vite-plus/test';
import { validateHandoff, installSubagentTool } from '../src/subagent.js';
import { createInitialState } from '../src/state.js';

describe('validateHandoff', () => {
  it('returns valid for a handoff with all 6 fields', () => {
    const handoff = [
      '**Goal:** build feature',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    expect(validateHandoff(handoff).valid).toBe(true);
  });

  it('returns errors when a field is missing', () => {
    const handoff = '**Goal:** build feature\n**Context:** missing some fields';
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts multi-line field values across line breaks', () => {
    const handoff = [
      '**Goal:** Build something',
      '  that spans multiple',
      '  lines of text',
      '**Context:** in repo root',
      '**Requirements:** must be fast',
      '**Known problems:** none',
      '**Success criteria:** tests pass',
      '**Next step:** merge PR',
    ].join('\n');
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(true);
  });

  it('returns errors when a field has no content (only whitespace, nothing follows)', () => {
    const handoff = '**Goal:** \n\n';
    const result = validateHandoff(handoff);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Goal'))).toBe(true);
  });
});

describe('installSubagentTool', () => {
  it('registers a tool named "maestria_subagent"', () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);
    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    expect(toolDef.name).toBe('maestria_subagent');
  });

  it('rejects unknown agent names', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await expect(
      toolDef.execute(
        'call-1',
        { agent: 'unknown', task: 'do something' },
        undefined,
        undefined,
        {},
      ),
    ).rejects.toThrow('Unknown agent');
  });

  it('rejects empty task description', async () => {
    const pi = { registerTool: vi.fn() };
    const state = createInitialState();
    installSubagentTool(pi as any, state);

    const toolDef = (pi as any).registerTool.mock.calls[0][0];
    await expect(
      toolDef.execute('call-1', { agent: 'builder', task: '' }, undefined, undefined, {}),
    ).rejects.toThrow('Task description is required');
  });
});
