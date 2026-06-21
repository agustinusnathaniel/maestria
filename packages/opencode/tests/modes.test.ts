import { describe, it, expect } from 'vite-plus/test';
import { detectMode, stripKeyword, getModeMarker, getModePrompt } from '@/modes/index.js';
import type { ModeResult } from '@/modes/types.js';
import { MaestriaPlugin } from '@/index.js';

function expectNotNull<T>(value: T | null): asserts value is T {
  expect(value).not.toBeNull();
}

// ---------------------------------------------------------------------------
// detectMode
// ---------------------------------------------------------------------------
describe('detectMode', () => {
  it('detects keyword at start of message', () => {
    const result = detectMode('fein build the feature');
    expectNotNull(result);
    expect(result.mode).toBe('fein');
    expect(result.keyword).toBe('fein');
    expect(result.index).toBe(0);
  });

  it('detects keyword in middle of message', () => {
    const result = detectMode("let's sonar this design");
    expectNotNull(result);
    expect(result.mode).toBe('sonar');
    expect(result.keyword).toBe('sonar');
    expect(result.index).toBe(6);
  });

  it('detects keyword at end of message', () => {
    const result = detectMode('implement it blitz');
    expectNotNull(result);
    expect(result.mode).toBe('blitz');
    expect(result.keyword).toBe('blitz');
  });

  it('most restrictive wins with multiple keywords', () => {
    const r1 = detectMode('fein research then blitz implement');
    expectNotNull(r1);
    expect(r1.mode).toBe('fein');
    expect(r1.index).toBe(0);

    const r2 = detectMode('fein sonar blitz');
    expectNotNull(r2);
    expect(r2.mode).toBe('fein');

    const r3 = detectMode('sonar blitz');
    expectNotNull(r3);
    expect(r3.mode).toBe('sonar');
  });

  it('priority order is fein > sonar > blitz regardless of position', () => {
    const r1 = detectMode('blitz sonar fein');
    expectNotNull(r1);
    expect(r1.mode).toBe('fein');

    const r2 = detectMode('fein blitz sonar');
    expectNotNull(r2);
    expect(r2.mode).toBe('fein');

    const r3 = detectMode('blitz sonar');
    expectNotNull(r3);
    expect(r3.mode).toBe('sonar');
  });

  it('returns null when no keyword present', () => {
    const result = detectMode('please implement this feature');
    expect(result).toBeNull();
  });

  it('is case insensitive (FEIN, Sonar, BLITZ)', () => {
    const r1 = detectMode('FEIN uppercase');
    expectNotNull(r1);
    expect(r1.mode).toBe('fein');

    const r2 = detectMode('Sonar title case');
    expectNotNull(r2);
    expect(r2.mode).toBe('sonar');

    const r3 = detectMode('uppercase BLITZ');
    expectNotNull(r3);
    expect(r3.mode).toBe('blitz');
  });

  it('does not match inside word boundaries (feinish, dfein, blitzkrieg)', () => {
    expect(detectMode('feinish the work')).toBeNull();
    expect(detectMode('dfein research')).toBeNull();
    expect(detectMode('blitzkrieg attack')).toBeNull();
  });

  it('does not match inside fenced code blocks', () => {
    const text = '```blitz this```';
    const result = detectMode(text);
    expect(result).toBeNull();
  });

  it('detects keyword outside code block correctly', () => {
    const text = 'some code:\n```\nconst x = 1;\n```\nfein then build';
    const result = detectMode(text);
    expectNotNull(result);
    expect(result.mode).toBe('fein');
  });

  it('does not match inside inline backtick content', () => {
    const text = 'run `blitz` command';
    const result = detectMode(text);
    expect(result).toBeNull();
  });

  it('matches hyphenated keyword (sonar-like)', () => {
    // Hyphen is a non-word char boundary, so `sonar` in `sonar-like` matches
    const result = detectMode('sonar-like exploration');
    expectNotNull(result);
    expect(result.mode).toBe('sonar');
  });

  it('respects disabled keywords', () => {
    const result = detectMode('fein research then blitz build', new Set(['blitz']));
    expectNotNull(result);
    expect(result.mode).toBe('fein');
  });

  it('returns null when all keywords disabled', () => {
    const result = detectMode('fein research', new Set(['fein', 'sonar', 'blitz']));
    expect(result).toBeNull();
  });

  it('handles empty string', () => {
    const result = detectMode('');
    expect(result).toBeNull();
  });

  it('detects keyword with trailing colon', () => {
    const result = detectMode('fein: build the feature');
    expectNotNull(result);
    expect(result.mode).toBe('fein');
    expect(result.index).toBe(0);
    expect(result.keyword).toBe('fein');
  });

  it('returns prompt and marker in result', () => {
    const result = detectMode('sonar research this');
    expectNotNull(result);
    expect(result.prompt).toBeTruthy();
    expect(result.marker).toBe('[MODE: sonar]');
  });
});

// ---------------------------------------------------------------------------
// stripKeyword
// ---------------------------------------------------------------------------
describe('stripKeyword', () => {
  function makeResult(
    mode: 'fein' | 'sonar' | 'blitz',
    keyword: string,
    index: number,
  ): ModeResult {
    return {
      mode,
      keyword,
      index,
      prompt: getModePrompt(mode),
      marker: getModeMarker(mode),
    };
  }

  it('removes keyword from start', () => {
    const text = 'fein build the feature';
    const result = makeResult('fein', 'fein', 0);
    expect(stripKeyword(text, result)).toBe('build the feature');
  });

  it('removes keyword from middle, collapsing double spaces', () => {
    const text = "let's sonar research this";
    const result = makeResult('sonar', 'sonar', 6);
    expect(stripKeyword(text, result)).toBe("let's research this");
  });

  it('removes keyword from end, trimming trailing whitespace', () => {
    const text = 'implement it blitz';
    const result = makeResult('blitz', 'blitz', 13);
    expect(stripKeyword(text, result)).toBe('implement it');
  });

  it('trims extra whitespace', () => {
    const text = 'fein   build the feature';
    const result = makeResult('fein', 'fein', 0);
    expect(stripKeyword(text, result)).toBe('build the feature');
  });

  it('returns empty string for keyword-only message', () => {
    const text = 'fein';
    const result = makeResult('fein', 'fein', 0);
    expect(stripKeyword(text, result)).toBe('');
  });

  it('handles keyword followed by colon', () => {
    const text = 'fein: build the feature';
    const result = makeResult('fein', 'fein', 0);
    expect(stripKeyword(text, result)).toBe('build the feature');
  });

  it('handles keyword followed by colon and extra space', () => {
    const text = 'fein:  build the feature';
    const result = makeResult('fein', 'fein', 0);
    expect(stripKeyword(text, result)).toBe('build the feature');
  });

  it('does not strip meaningfully when keyword is not present', () => {
    const text = 'just a normal message';
    // Simulating a result that wouldn't actually be returned by detectMode
    const result = makeResult('fein', 'fein', 100);
    expect(stripKeyword(text, result)).toBe('just a normal message');
  });
});

// ---------------------------------------------------------------------------
// Config validation (MaestriaPlugin)
// ---------------------------------------------------------------------------
describe('MaestriaPlugin config validation', () => {
  it('throws on unknown keyword', async () => {
    await expect(
      MaestriaPlugin({} as never, {
        modes: { disabledKeywords: ['invalid'] as any },
      }),
    ).rejects.toThrow(
      "Invalid enum value. Expected 'fein' | 'sonar' | 'blitz', received 'invalid'",
    );
  });

  it('accepts valid config with disabled keywords', async () => {
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: ['blitz'] },
    });
    expect(plugin).toBeDefined();
    expect(typeof plugin.config).toBe('function');
  });

  it('accepts no options (all modes active)', async () => {
    const plugin = await MaestriaPlugin({} as never);
    expect(plugin).toBeDefined();
    expect(typeof plugin.config).toBe('function');
  });

  it('accepts empty disabledKeywords array', async () => {
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: [] },
    });
    expect(plugin).toBeDefined();
    expect(typeof plugin.config).toBe('function');
  });

  it('throws if disabledKeywords is not an array', async () => {
    await expect(
      MaestriaPlugin({} as never, {
        modes: { disabledKeywords: 'fein' as any },
      }),
    ).rejects.toThrow('Expected array, received string');
  });
});

// ---------------------------------------------------------------------------
// MaestriaPlugin chat.message hook
// ---------------------------------------------------------------------------
describe('MaestriaPlugin chat.message hook', () => {
  it('includes chat.message hook when options are provided', async () => {
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: [] },
    });
    expect(typeof (plugin as any)['chat.message']).toBe('function');
  });

  it('includes chat.message hook when no options', async () => {
    const plugin = await MaestriaPlugin({} as never);
    expect(typeof (plugin as any)['chat.message']).toBe('function');
  });

  it('passes through normal message without modification', async () => {
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: [] },
    });
    const hook = (plugin as any)['chat.message'];

    const input = { sessionID: 's1', agent: 'orchestrator' };
    const textPart = {
      id: 'p1',
      sessionID: 's1',
      messageID: 'm1',
      type: 'text',
      text: 'build this feature',
    };
    const output = {
      message: {
        id: 'm1',
        sessionID: 's1',
        role: 'user',
        time: { created: 1 },
        agent: 'orchestrator',
      },
      parts: [textPart],
    };

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toBe('build this feature');
  });

  it('injects mode inline without adding new parts for keyword message', async () => {
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: [] },
    });
    const hook = (plugin as any)['chat.message'];

    const input = { sessionID: 's1', agent: 'orchestrator' };
    const textPart = {
      id: 'p1',
      sessionID: 's1',
      messageID: 'm1',
      type: 'text',
      text: 'fein build this',
    };
    const output = {
      message: {
        id: 'm1',
        sessionID: 's1',
        role: 'user',
        time: { created: 1 },
        agent: 'orchestrator',
      },
      parts: [textPart],
    };

    await hook(input, output);

    // Must NOT add new parts (that's the bug fix)
    expect(output.parts).toHaveLength(1);

    // Keyword stripped, mode marker + prompt prepended inline
    expect(output.parts[0].text).toContain('[MODE: fein]');
    expect(output.parts[0].text).toContain('Full Pipeline');
    expect(output.parts[0].text).toContain('build this');

    // Marker appears before the user message
    const markerIndex = output.parts[0].text.indexOf('[MODE: fein]');
    const messageIndex = output.parts[0].text.indexOf('build this');
    expect(markerIndex).toBeLessThan(messageIndex);
  });

  it('injects sonar mode inline without adding new parts', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const hook = (plugin as any)['chat.message'];

    const input = { sessionID: 's1', agent: 'orchestrator' };
    const textPart = {
      id: 'p1',
      sessionID: 's1',
      messageID: 'm1',
      type: 'text',
      text: 'sonar research only',
    };
    const output = {
      message: {
        id: 'm1',
        sessionID: 's1',
        role: 'user',
        time: { created: 1 },
        agent: 'orchestrator',
      },
      parts: [textPart],
    };

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toContain('[MODE: sonar]');
    expect(output.parts[0].text).toContain('research only');
  });

  it('does not fire for non-orchestrator agents', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const hook = (plugin as any)['chat.message'];

    const input = { sessionID: 's1', agent: 'builder' };
    const textPart = {
      id: 'p1',
      sessionID: 's1',
      messageID: 'm1',
      type: 'text',
      text: 'fein build this',
    };
    const output = {
      message: { id: 'm1', sessionID: 's1', role: 'user', time: { created: 1 }, agent: 'builder' },
      parts: [textPart],
    };

    await hook(input, output);

    // Must NOT modify text for non-orchestrator agents
    expect(output.parts[0].text).toBe('fein build this');
  });

  it('handles keyword-only message without crash', async () => {
    const plugin = await MaestriaPlugin({} as never);
    const hook = (plugin as any)['chat.message'];

    const input = { sessionID: 's1', agent: 'orchestrator' };
    const textPart = { id: 'p1', sessionID: 's1', messageID: 'm1', type: 'text', text: 'fein' };
    const output = {
      message: {
        id: 'm1',
        sessionID: 's1',
        role: 'user',
        time: { created: 1 },
        agent: 'orchestrator',
      },
      parts: [textPart],
    };

    // Must not throw
    await expect(hook(input, output)).resolves.toBeUndefined();

    // Parts array still intact
    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toContain('[MODE: fein]');
  });
});

// ---------------------------------------------------------------------------
// chat.message hook integration (realistic mock inputs via helper functions)
// ---------------------------------------------------------------------------
import crypto from 'node:crypto';

async function createHook(disabledKeywords?: string[]) {
  const plugin = await MaestriaPlugin(
    {} as never,
    disabledKeywords ? { modes: { disabledKeywords } } : undefined,
  );
  return (plugin as any)['chat.message'];
}

function createMockMessage(text: string, agent = 'orchestrator') {
  const id = crypto.randomUUID();
  return {
    input: { sessionID: 'test-session', agent, messageID: id },
    output: {
      message: {
        id,
        sessionID: 'test-session',
        role: 'user' as const,
        agent,
        time: { created: Date.now() },
      },
      parts: [{ id, sessionID: 'test-session', messageID: id, type: 'text' as const, text }],
    },
  };
}

describe('chat.message hook integration', () => {
  it('prepends mode marker to existing text part for fein', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('fein build the api');

    await hook(input, output);

    // Should be exactly 1 part (no new parts added)
    expect(output.parts).toHaveLength(1);
    // The text should contain the mode marker
    expect(output.parts[0].text).toContain('[MODE: fein]');
    // The text should contain the mode prompt
    expect(output.parts[0].text).toContain('Full Pipeline');
    // The keyword should NOT be in the text
    expect(output.parts[0].text).not.toContain('fein build');
    // The user's message should still be present
    expect(output.parts[0].text).toContain('build the api');
  });

  it('prepends mode marker to existing text part for sonar', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('sonar research the design');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toContain('[MODE: sonar]');
    expect(output.parts[0].text).toContain('Research Only');
    expect(output.parts[0].text).not.toContain('sonar research');
    expect(output.parts[0].text).toContain('research the design');
  });

  it('prepends mode marker to existing text part for blitz', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('blitz implement the feature');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toContain('[MODE: blitz]');
    expect(output.parts[0].text).toContain('Fast Implementation');
    expect(output.parts[0].text).not.toContain('blitz implement');
    expect(output.parts[0].text).toContain('implement the feature');
  });

  it('is no-op for non-orchestrator agents', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('fein build the api', 'builder');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toBe('fein build the api');
  });

  it('is no-op when no keyword present', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('build the api');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toBe('build the api');
  });

  it('is no-op when all keywords disabled', async () => {
    const hook = await createHook(['fein', 'sonar', 'blitz']);
    const { input, output } = createMockMessage('fein build the api');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toBe('fein build the api');
  });

  it('most restrictive keyword wins when multiple present', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('blitz research then fein build');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toContain('[MODE: fein]');
    expect(output.parts[0].text).not.toContain('[MODE: blitz]');
    expect(output.parts[0].text).toContain('research then build');
  });

  it('does not detect keyword inside code block', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('run this:\n```\nfein command\n```\nthen check');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toBe('run this:\n```\nfein command\n```\nthen check');
  });
});
