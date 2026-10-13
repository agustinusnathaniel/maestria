import type { Hooks } from '@opencode-ai/plugin';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vite-plus/test';

import { MaestriaPlugin } from '@/index.js';
import { detectMode } from '@/modes/index.js';
import type { ModeKeyword } from '@/modes/types.js';
import { pluginInput } from './helpers.js';

type ChatMessageHook = NonNullable<Hooks['chat.message']>;
type ChatMessageInput = Parameters<ChatMessageHook>[0];
type ChatMessageOutput = Parameters<ChatMessageHook>[1];
type TextPart = Extract<ChatMessageOutput['parts'][number], { type: 'text' }>;

const expectNotNull: <T>(value: T | null) => asserts value is T = (value) => {
  expect(value).not.toBeNull();
};

const getChatMessageHook = (plugin: Hooks): ChatMessageHook => {
  const hook = plugin['chat.message'];
  if (hook === undefined) {
    throw new Error('Expected chat.message hook');
  }
  return hook;
};

const getTextPart = (output: ChatMessageOutput): TextPart => {
  const textPart = output.parts.find((part): part is TextPart => part.type === 'text');
  if (textPart === undefined) {
    throw new Error('Expected text part');
  }
  return textPart;
};

const createMockMessage = (
  text: string,
  agent = 'orchestrator',
): { input: ChatMessageInput; output: ChatMessageOutput } => {
  const id = crypto.randomUUID();
  return {
    input: { agent, messageID: id, sessionID: 'test-session' },
    output: {
      message: {
        agent,
        id,
        model: { modelID: 'test-model', providerID: 'test-provider' },
        role: 'user',
        sessionID: 'test-session',
        time: { created: Date.now() },
      },
      parts: [{ id, messageID: id, sessionID: 'test-session', text, type: 'text' }],
    },
  };
};

// ---------------------------------------------------------------------------
// detectMode
// ---------------------------------------------------------------------------
// Pure detection behavior (priority, word boundaries, code-block exclusion,
// disabled keywords, case-insensitivity) is owned by `@maestria/shared-mode`
// and covered in packages/shared/mode/tests/mode.test.ts. What is unique here
// is the opencode wrapper: augmenting a shared hit with `marker` and `prompt`,
// and passing the shared fields through unchanged.
describe('detectMode', () => {
  it('passes through index, keyword, and mode from shared detection', () => {
    const result = detectMode("let's Sonar this");
    expectNotNull(result);
    expect(result.index).toBe(6);
    expect(result.keyword).toBe('Sonar');
    expect(result.mode).toBe('sonar');
  });

  it('returns prompt and marker in result', () => {
    const result = detectMode('sonar research this');
    expectNotNull(result);
    expect(result.prompt).toBeTruthy();
    expect(result.marker).toBe('[MODE: sonar]');
  });
});

// ---------------------------------------------------------------------------
// Config validation (MaestriaPlugin)
// ---------------------------------------------------------------------------
describe('MaestriaPlugin config validation', () => {
  it('throws on unknown keyword', async () => {
    await expect(
      MaestriaPlugin(pluginInput, {
        modes: { disabledKeywords: ['invalid'] },
      }),
    ).rejects.toThrow(/Invalid option: expected one of \\"fein\\"\|\\"sonar\\"\|\\"blitz\\"/u);
  });

  it('accepts valid config with disabled keywords', async () => {
    const plugin = await MaestriaPlugin(pluginInput, {
      modes: { disabledKeywords: ['blitz'] },
    });
    expect(typeof plugin.config).toBe('function');
  });

  it('throws if disabledKeywords is not an array', async () => {
    await expect(
      MaestriaPlugin(pluginInput, {
        modes: { disabledKeywords: 'fein' },
      }),
    ).rejects.toThrow('Invalid input: expected array, received string');
  });
});

// ---------------------------------------------------------------------------
// MaestriaPlugin chat.message hook
// ---------------------------------------------------------------------------
describe('MaestriaPlugin chat.message hook', () => {
  it('registers the chat.message hook when options are provided', async () => {
    const plugin = await MaestriaPlugin(pluginInput, {
      modes: { disabledKeywords: [] },
    });
    expect(typeof getChatMessageHook(plugin)).toBe('function');
  });

  it('handles keyword-only message without crash', async () => {
    const plugin = await MaestriaPlugin(pluginInput);
    const hook = getChatMessageHook(plugin);
    const { input, output } = createMockMessage('fein');

    // Must not throw
    await expect(hook(input, output)).resolves.toBeUndefined();

    // Parts array still intact
    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toContain('[MODE: fein]');
  });
});

// ---------------------------------------------------------------------------
// chat.message hook integration (realistic mock inputs via helper functions)
// ---------------------------------------------------------------------------
const createHook = async (disabledKeywords?: ModeKeyword[]): Promise<ChatMessageHook> => {
  const plugin = await MaestriaPlugin(
    pluginInput,
    disabledKeywords ? { modes: { disabledKeywords } } : undefined,
  );
  return getChatMessageHook(plugin);
};

describe('chat.message hook integration', () => {
  it('prepends mode marker to existing text part for fein', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('fein build the api');

    await hook(input, output);

    // Should be exactly 1 part (no new parts added)
    expect(output.parts).toHaveLength(1);
    const { text } = getTextPart(output);
    // The text should contain the mode marker
    expect(text).toContain('[MODE: fein]');
    // The text should contain the mode prompt
    expect(text).toContain('Full Pipeline');
    // The keyword should NOT be in the text
    expect(text).not.toContain('fein build');
    // The user's message should still be present
    expect(text).toContain('build the api');
    // Marker appears before the user message
    expect(text.indexOf('[MODE: fein]')).toBeLessThan(text.indexOf('build the api'));
  });

  it('prepends mode marker to existing text part for sonar', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('sonar research the design');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toContain('[MODE: sonar]');
    expect(getTextPart(output).text).toContain('Research Only');
    expect(getTextPart(output).text).not.toContain('sonar research');
    expect(getTextPart(output).text).toContain('research the design');
  });

  it('prepends mode marker to existing text part for blitz', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('blitz implement the feature');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toContain('[MODE: blitz]');
    expect(getTextPart(output).text).toContain('Fast Implementation');
    expect(getTextPart(output).text).not.toContain('blitz implement');
    expect(getTextPart(output).text).toContain('implement the feature');
  });

  it('is no-op for non-orchestrator agents', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('fein build the api', 'builder');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toBe('fein build the api');
  });

  it('is no-op when no keyword present', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('build the api');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toBe('build the api');
  });

  it('is no-op when all keywords disabled', async () => {
    const hook = await createHook(['fein', 'sonar', 'blitz']);
    const { input, output } = createMockMessage('fein build the api');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toBe('fein build the api');
  });

  it('most restrictive keyword wins when multiple present', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('blitz research then fein build');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toContain('[MODE: fein]');
    expect(getTextPart(output).text).not.toContain('[MODE: blitz]');
    expect(getTextPart(output).text).toContain('research then build');
  });

  it('does not detect keyword inside code block', async () => {
    const hook = await createHook();
    const { input, output } = createMockMessage('run this:\n```\nfein command\n```\nthen check');

    await hook(input, output);

    expect(output.parts).toHaveLength(1);
    expect(getTextPart(output).text).toBe('run this:\n```\nfein command\n```\nthen check');
  });
});
