import { describe, expect, it } from 'vite-plus/test';

import extension from '../src/extension.ts';
import { STATUS_COMMAND } from '../src/modes.ts';
import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ExtensionEventRegistration,
  RegisteredCommandOptions,
  SessionEntry,
} from '../src/pi-api.ts';
import { MODE_STATE_CUSTOM_TYPE } from '../src/state.ts';

interface FakePi {
  pi: ExtensionAPI;
  /** Handlers recorded per event name, in subscription order. */
  handlers: Set<string>;
  /** (name, options) pairs recorded per command. */
  commands: {
    name: string;
    options: RegisteredCommandOptions;
  }[];
  /** (customType, data) pairs recorded per appendEntry call. */
  entries: { customType: string; data?: unknown }[];
  /** (content, options) pairs recorded per sendUserMessage call. */
  sentMessages: { content: string; options?: { deliverAs?: 'steer' | 'followUp' } }[];
  /** Last systemPrompt passed to a before_agent_start handler, if any. */
  fire: {
    beforeAgentStart: (systemPrompt: string) => Promise<BeforeAgentStartEventResult | undefined>;
    sessionStart: (ctx: ExtensionContext) => Promise<unknown>;
    sessionTree: (ctx: ExtensionContext) => Promise<unknown>;
  };
}

const emptyContext: ExtensionContext = {
  cwd: '/',
  hasUI: true,
  sessionManager: {
    getBranch: () => [],
    getEntries: () => [],
  },
  ui: { notify: () => {}, setEditorText: () => {} },
};

const createFakePi = (): FakePi => {
  const handlers = new Set<string>();
  const commands: FakePi['commands'] = [];
  const entries: FakePi['entries'] = [];
  const sentMessages: FakePi['sentMessages'] = [];
  let beforeAgentStartHandler:
    | Extract<ExtensionEventRegistration, ['before_agent_start', unknown]>[1]
    | undefined;
  let sessionStartHandler:
    | Extract<ExtensionEventRegistration, ['session_start', unknown]>[1]
    | undefined;
  let sessionTreeHandler:
    | Extract<ExtensionEventRegistration, ['session_tree', unknown]>[1]
    | undefined;

  const on = (...[event, handler]: ExtensionEventRegistration): void => {
    handlers.add(event);
    switch (event) {
      case 'before_agent_start': {
        beforeAgentStartHandler = handler;
        break;
      }
      case 'session_start': {
        sessionStartHandler = handler;
        break;
      }
      case 'session_tree': {
        sessionTreeHandler = handler;
        break;
      }
      default: {
        throw new Error('unsupported event');
      }
    }
  };

  const pi: ExtensionAPI = {
    appendEntry: (customType, data) => {
      entries.push({ customType, data });
    },
    on,
    registerCommand: (name, options) => {
      commands.push({ name, options });
    },
    sendUserMessage: (content, options) => {
      sentMessages.push({ content, options });
    },
  };

  const fire = {
    beforeAgentStart: async (
      systemPrompt: string,
    ): Promise<BeforeAgentStartEventResult | undefined> => {
      const handler = beforeAgentStartHandler;
      if (!handler) {
        throw new Error('no before_agent_start handler subscribed');
      }
      return await handler({ prompt: 'p', systemPrompt, type: 'before_agent_start' }, emptyContext);
    },
    sessionStart: async (ctx: ExtensionContext): Promise<unknown> => {
      const handler = sessionStartHandler;
      if (!handler) {
        throw new Error('no session_start handler subscribed');
      }
      return await handler({ reason: 'startup', type: 'session_start' }, ctx);
    },
    sessionTree: async (ctx: ExtensionContext): Promise<unknown> => {
      const handler = sessionTreeHandler;
      if (!handler) {
        throw new Error('no session_tree handler subscribed');
      }
      return await handler({ newLeafId: null, oldLeafId: null, type: 'session_tree' }, ctx);
    },
  };

  return { commands, entries, fire, handlers, pi, sentMessages };
};

const commandHandler = (fake: FakePi, name: string): RegisteredCommandOptions['handler'] => {
  const command = fake.commands.find((c) => c.name === name);
  if (!command) {
    throw new Error(`command ${name} not registered`);
  }
  return command.options.handler;
};

const branchContext = (entries: SessionEntry[]): ExtensionContext => ({
  cwd: '/',
  hasUI: true,
  sessionManager: {
    getBranch: () => entries,
    getEntries: () => entries,
  },
  ui: { notify: () => {}, setEditorText: () => {} },
});

/** Command-handler context with a fake UI, for invoking registered commands. */
const commandContext = (ui?: {
  notify?: (m: string) => void;
  setEditorText?: (t: string) => void;
}): ExtensionCommandContext => ({
  cwd: '/',
  hasUI: true,
  sessionManager: {
    getBranch: () => [],
    getEntries: () => [],
  },
  ui: { notify: () => {}, setEditorText: () => {}, ...ui },
});

const customEntry = (
  data: unknown,
  timestamp: number,
  customType = MODE_STATE_CUSTOM_TYPE,
): SessionEntry => ({
  customType,
  data,
  id: `e-${timestamp}`,
  parentId: null,
  timestamp: String(timestamp),
  type: 'custom',
});

const modeEntry = (mode: 'fein' | 'sonar' | 'blitz' | null, timestamp: number): SessionEntry =>
  // SessionEntryBase requires id/parentId/timestamp (aligned to the pinned
  // fork); readModeStateFromEntries only inspects type/customType/data, but
  // the fixture must satisfy the full shape to mirror a real session read.
  customEntry({ mode }, timestamp);

const getSystemPrompt = (result: BeforeAgentStartEventResult | undefined): string => {
  if (result?.systemPrompt === undefined) {
    throw new Error('expected before_agent_start to return a system prompt');
  }
  return result.systemPrompt;
};

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
    expect([...fake.handlers.keys()].toSorted()).toEqual([
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
    const ctx = commandContext({
      notify: (m: string) => {
        notifications.push(m);
      },
    });

    await commandHandler(fake, 'fein')('', ctx);

    expect(fake.entries.at(-1)).toEqual({
      customType: MODE_STATE_CUSTOM_TYPE,
      data: { mode: 'fein' },
    });
    expect(notifications[0]).toContain('fein');

    // The active mode now drives prompt injection on the next agent turn.
    const result = await fake.fire.beforeAgentStart('BASE SYSTEM PROMPT');
    expect(result).toBeDefined();
    const systemPrompt = getSystemPrompt(result);
    expect(systemPrompt.startsWith('BASE SYSTEM PROMPT')).toBe(true);
    expect(systemPrompt).toContain('[MODE: fein]');
    expect(systemPrompt).toContain('## MODE: fein');
    expect(systemPrompt).toContain('workflow mode to "fein"');
  });

  it('registers all three mode keywords', async () => {
    const modeResults = await Promise.all(
      (['sonar', 'blitz'] as const).map(async (mode) => {
        const modeFake = createFakePi();
        extension(modeFake.pi);
        await commandHandler(modeFake, mode)('', commandContext());
        return {
          entries: modeFake.entries,
          mode,
          result: await modeFake.fire.beforeAgentStart('BASE'),
        };
      }),
    );
    for (const { entries, mode, result } of modeResults) {
      expect(entries.at(-1)).toEqual({ customType: MODE_STATE_CUSTOM_TYPE, data: { mode } });
      expect(getSystemPrompt(result)).toContain(`[MODE: ${mode}]`);
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
    expect(getSystemPrompt(result)).toContain('[MODE: fein]');
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
    expect(getSystemPrompt(result)).toContain('[MODE: sonar]');
  });

  it('prefers the most recent maestria_mode entry on the branch', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    await fake.fire.sessionStart(
      branchContext([modeEntry('fein', 50), modeEntry('blitz', 90), modeEntry('sonar', 120)]),
    );
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(getSystemPrompt(result)).toContain('[MODE: sonar]');
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
    expect(getSystemPrompt(result)).toContain('[MODE: blitz]');
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
    await fake.fire.sessionStart(branchContext([customEntry({ mode: 'chaos' }, 100)]));
    const result = await fake.fire.beforeAgentStart('BASE');
    expect(result).toBeUndefined();
  });

  it('ignores malformed maestria_mode data and unrelated custom entries', async () => {
    const fake = createFakePi();
    extension(fake.pi);
    await fake.fire.sessionStart(
      branchContext([
        customEntry('not-an-object', 100),
        customEntry({ mode: 7 }, 150),
        customEntry({ mode: 'fein' }, 200, 'some-other-extension'),
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
    const ctx = commandContext({
      setEditorText: (t: string) => {
        texts.push(t);
      },
    });

    await commandHandler(fake, 'fein')('', ctx);
    await commandHandler(fake, STATUS_COMMAND)('', ctx);

    const [text] = texts;
    if (text === undefined) {
      throw new Error('status command did not set editor text');
    }
    expect(text).toContain('Workflow mode: fein');
    expect(text).toContain('/sonar');
    expect(text).toContain('/mode-clear');
    expect(text).toContain('rlm');
    expect(text).toContain('NOT provided');
  });
});
