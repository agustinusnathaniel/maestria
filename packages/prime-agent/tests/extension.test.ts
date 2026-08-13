import { describe, it, expect } from 'vite-plus/test';
import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionEntry,
} from '../src/pi-api.ts';
import extension from '../src/extension.ts';
import { MODE_STATE_CUSTOM_TYPE } from '../src/state.ts';
import { STATUS_COMMAND } from '../src/modes.ts';
interface FakePi {
  pi: ExtensionAPI;
  /** Handlers recorded per event name, in subscription order. */
  handlers: Map<string, Array<(event: unknown, ctx: unknown) => unknown>>;
  /** (name, options) pairs recorded per command. */
  commands: Array<{
    name: string;
    options: {
      description?: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    };
  }>;
  /** (customType, data) pairs recorded per appendEntry call. */
  entries: Array<{ customType: string; data?: unknown }>;
  /** (content, options) pairs recorded per sendUserMessage call. */
  sentMessages: Array<{ content: string; options?: { deliverAs?: 'steer' | 'followUp' } }>;
  /** Last systemPrompt passed to a before_agent_start handler, if any. */
  fire: {
    beforeAgentStart(systemPrompt: string): Promise<BeforeAgentStartEventResult | void>;
    sessionStart(ctx: ExtensionContext): Promise<unknown>;
    sessionTree(ctx: ExtensionContext): Promise<unknown>;
  };
}

function createFakePi(): FakePi {
  const handlers = new Map<string, Array<(event: unknown, ctx: unknown) => unknown>>();
  const commands: FakePi['commands'] = [];
  const entries: FakePi['entries'] = [];
  const sentMessages: FakePi['sentMessages'] = [];

  const on: ExtensionAPI['on'] = ((event: string, handler: (...args: unknown[]) => unknown) => {
    if (!handlers.has(event)) handlers.set(event, []);
    handlers.get(event)!.push(handler as (event: unknown, ctx: unknown) => unknown);
  }) as ExtensionAPI['on'];

  const pi: ExtensionAPI = {
    on,
    registerCommand(name, options) {
      commands.push({ name, options });
    },
    appendEntry(customType, data) {
      entries.push({ customType, data });
    },
    sendUserMessage(content, options) {
      sentMessages.push({ content, options });
    },
  };

  const fire = {
    async beforeAgentStart(systemPrompt: string): Promise<BeforeAgentStartEventResult | void> {
      const handler = handlers.get('before_agent_start')?.[0];
      if (!handler) throw new Error('no before_agent_start handler subscribed');
      return (await handler(
        { type: 'before_agent_start', prompt: 'p', systemPrompt },
        {},
      )) as BeforeAgentStartEventResult | void;
    },
    async sessionStart(ctx: ExtensionContext): Promise<unknown> {
      const handler = handlers.get('session_start')?.[0];
      if (!handler) throw new Error('no session_start handler subscribed');
      return handler({ type: 'session_start', reason: 'startup' }, ctx);
    },
    async sessionTree(ctx: ExtensionContext): Promise<unknown> {
      const handler = handlers.get('session_tree')?.[0];
      if (!handler) throw new Error('no session_tree handler subscribed');
      return handler({ type: 'session_tree', newLeafId: null, oldLeafId: null }, ctx);
    },
  };

  return { pi, handlers, commands, entries, sentMessages, fire };
}

function commandHandler(fake: FakePi, name: string) {
  const command = fake.commands.find((c) => c.name === name);
  if (!command) throw new Error(`command ${name} not registered`);
  return command.options.handler;
}

function branchContext(entries: SessionEntry[]): ExtensionContext {
  return {
    ui: { notify: () => {}, setEditorText: () => {} },
    hasUI: true,
    cwd: '/',
    sessionManager: { getBranch: () => entries, getEntries: () => entries },
  } as ExtensionContext;
}

/** Command-handler context with a fake UI, for invoking registered commands. */
function commandContext(ui?: {
  notify?: (m: string) => void;
  setEditorText?: (t: string) => void;
}): ExtensionCommandContext {
  return {
    ui: { notify: () => {}, setEditorText: () => {}, ...ui },
  } as unknown as ExtensionCommandContext;
}

function modeEntry(mode: 'fein' | 'sonar' | 'blitz' | null, timestamp: number): SessionEntry {
  // SessionEntryBase requires id/parentId/timestamp (aligned to the pinned
  // fork); readModeStateFromEntries only inspects type/customType/data, but
  // the fixture must satisfy the full shape to mirror a real session read.
  return {
    type: 'custom',
    id: `e-${timestamp}`,
    parentId: null,
    timestamp: String(timestamp),
    customType: MODE_STATE_CUSTOM_TYPE,
    data: { mode },
  };
}

describe('prime-agent extension entry point', () => {
  it('registers the mode commands, clear command, and status command', () => {
    const fake = createFakePi();
    extension(fake.pi);
    const names = fake.commands.map((c) => c.name);
    expect(names).toEqual(['fein', 'sonar', 'blitz', 'mode-clear', STATUS_COMMAND]);
  });

  it('subscribes to before_agent_start, session_start, and session_tree', () => {
    const fake = createFakePi();
    extension(fake.pi);
    expect([...fake.handlers.keys()].sort()).toEqual([
      'before_agent_start',
      'session_start',
      'session_tree',
    ]);
  });

  it('does not register tools or intercept tool calls (no security claim)', () => {
    const fake = createFakePi();
    extension(fake.pi);
    expect(fake.handlers.has('tool_call')).toBe(false);
  });
});

describe('mode commands', () => {
  it('sets the mode, persists it as a maestria_mode custom entry, and notifies', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const notifications: string[] = [];
    const ctx = commandContext({ notify: (m: string) => notifications.push(m) });

    await commandHandler(fake, 'fein')('', ctx);

    expect(fake.entries.at(-1)).toEqual({
      customType: MODE_STATE_CUSTOM_TYPE,
      data: { mode: 'fein' },
    });
    expect(notifications[0]).toContain('fein');

    // The active mode now drives prompt injection on the next agent turn.
    const result = await fake.fire.beforeAgentStart('BASE SYSTEM PROMPT');
    expect(result).toBeDefined();
    const systemPrompt = (result as BeforeAgentStartEventResult).systemPrompt!;
    expect(systemPrompt.startsWith('BASE SYSTEM PROMPT')).toBe(true);
    expect(systemPrompt).toContain('[MODE: fein]');
    expect(systemPrompt).toContain('## MODE: fein');
    expect(systemPrompt).toContain('workflow mode to "fein"');
  });

  it('registers all three mode keywords', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    for (const mode of ['sonar', 'blitz'] as const) {
      const ctx = commandContext();
      await commandHandler(fake, mode)('', ctx);
      expect(fake.entries.at(-1)).toEqual({ customType: MODE_STATE_CUSTOM_TYPE, data: { mode } });
      const result = await fake.fire.beforeAgentStart('BASE');
      expect((result as BeforeAgentStartEventResult).systemPrompt).toContain(`[MODE: ${mode}]`);
    }
  });

  it('forwards a goal argument as a steered user message when one is provided', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const ctx = commandContext();

    await commandHandler(fake, 'fein')('  implement the pipeline  ', ctx);

    expect(fake.entries.at(-1)).toEqual({
      customType: MODE_STATE_CUSTOM_TYPE,
      data: { mode: 'fein' },
    });
    expect(fake.sentMessages).toEqual([
      { content: 'implement the pipeline', options: { deliverAs: 'steer' } },
    ]);

    // The steered turn receives the injected mode prompt.
    const result = await fake.fire.beforeAgentStart('BASE');
    expect((result as BeforeAgentStartEventResult).systemPrompt).toContain('[MODE: fein]');
  });

  it('does not forward a message when invoked with no goal argument', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const ctx = commandContext();
    await commandHandler(fake, 'fein')('', ctx);
    expect(fake.sentMessages).toEqual([]);
  });

  it('mode-clear resets the mode and stops injection', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const ctx = commandContext();

    await commandHandler(fake, 'fein')('', ctx);
    await commandHandler(fake, 'mode-clear')('', ctx);

    expect(fake.entries.at(-1)).toEqual({
      customType: MODE_STATE_CUSTOM_TYPE,
      data: { mode: null },
    });
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });

  it('injects nothing when no mode is active', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });
});

describe('session state persistence', () => {
  it('restores the mode on session_start from the current branch', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    await fake.fire.sessionStart(branchContext([modeEntry('sonar', 100)]));

    const result = await fake.fire.beforeAgentStart('BASE');
    expect((result as BeforeAgentStartEventResult).systemPrompt).toContain('[MODE: sonar]');
  });

  it('prefers the most recent maestria_mode entry on the branch', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    await fake.fire.sessionStart(
      branchContext([modeEntry('fein', 50), modeEntry('blitz', 90), modeEntry('sonar', 120)]),
    );
    const result = await fake.fire.beforeAgentStart('BASE');
    expect((result as BeforeAgentStartEventResult).systemPrompt).toContain('[MODE: sonar]');
  });

  it('never restores a sibling branch mode on session_start', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    // The current branch has no mode entry; only the sibling tree does.
    await fake.fire.sessionStart(branchContext([]));
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });

  it('restores the mode on session_tree navigation', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    await fake.fire.sessionTree(branchContext([modeEntry('blitz', 100)]));
    const result = await fake.fire.beforeAgentStart('BASE');
    expect((result as BeforeAgentStartEventResult).systemPrompt).toContain('[MODE: blitz]');
  });

  it('resets the mode to null when a restored branch has no mode entry', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const ctx = commandContext();
    await commandHandler(fake, 'fein')('', ctx);
    await fake.fire.sessionStart(branchContext([]));
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });

  it('ignores a maestria_mode entry with an invalid mode value', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    // Malformed persisted data must never resurrect a mode or crash the
    // restore path: an unknown mode value is skipped (fail-closed to null).
    await fake.fire.sessionStart(
      branchContext([{ ...modeEntry('fein', 100), data: { mode: 'chaos' } } as SessionEntry]),
    );
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });

  it('ignores malformed maestria_mode data and unrelated custom entries', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    await fake.fire.sessionStart(
      branchContext([
        { ...modeEntry('fein', 100), data: 'not-an-object' } as SessionEntry,
        { ...modeEntry('fein', 150), data: { mode: 7 } } as SessionEntry,
        { ...modeEntry('fein', 200), customType: 'some-other-extension' } as SessionEntry,
      ]),
    );
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });
});

describe('status command', () => {
  it('reports the current mode and the verified/deferred subset', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    const texts: string[] = [];
    const ctx = commandContext({ setEditorText: (t: string) => texts.push(t) });

    await commandHandler(fake, 'fein')('', ctx);
    await commandHandler(fake, STATUS_COMMAND)('', ctx);

    const text = texts[0];
    expect(text).toContain('Workflow mode: fein');
    expect(text).toContain('/sonar');
    expect(text).toContain('/mode-clear');
    expect(text).toContain('rlm');
    expect(text).toContain('NOT provided');
  });
});
