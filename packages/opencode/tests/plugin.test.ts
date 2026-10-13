import { Effect } from 'effect';
import { Agent, Skill } from '@opencode/plugin/effect';
import type { Plugin } from '@opencode/plugin/effect';
import type { AgentEditor } from '@opencode/plugin/effect/agent';
import type { CommandEditor, CommandInvocation } from '@opencode/plugin/effect/command';
import type { SessionContext, SessionPrompt } from '@opencode/plugin/effect/session';
import type { SkillEditor } from '@opencode/plugin/effect/skill';
import { describe, expect, it } from 'vite-plus/test';
import plugin from '../src/index.js';

type Command = Parameters<CommandEditor['add']>[0];
type AgentDraft = Parameters<Parameters<AgentEditor['update']>[1]>[0];

interface Registrations {
  agent?: (editor: AgentEditor) => void;
  command?: (editor: CommandEditor) => void;
  skill?: (editor: SkillEditor) => void;
  prompt?: (event: SessionPrompt) => Effect.Effect<void>;
  context?: (event: SessionContext) => Effect.Effect<void>;
  compaction?: (event: SessionContext) => Effect.Effect<void>;
}

/** Loads the plugin against a host double that records each registration. */
const load = async (options: unknown = {}) => {
  const registrations: Registrations = {};
  const prompted: Record<string, unknown>[] = [];
  const registered = Effect.succeed({ dispose: Effect.void });
  // A `never` callback parameter is assignable to whichever registration slot it fills.
  const register = (name: keyof Registrations, apply: never) => {
    registrations[name] = apply;
    return registered;
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the double implements only the registration seams the plugin uses.
  const ctx = {
    agent: { transform: (apply: never) => register('agent', apply) },
    command: { transform: (apply: never) => register('command', apply) },
    location: { directory: process.cwd(), project: { directory: process.cwd() } },
    options,
    session: {
      hook: register,
      prompt: (input: Record<string, unknown>) => {
        prompted.push(input);
        return Effect.void;
      },
    },
    skill: { transform: (apply: never) => register('skill', apply) },
  } as unknown as Plugin.Context;
  await Effect.runPromise(Effect.scoped(plugin.effect(ctx)));

  const admit = async (
    text: string,
    extra: Partial<SessionPrompt> = {},
  ): Promise<SessionPrompt> => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- admission reads only the prompt and metadata.
    const event = { prompt: { text }, sessionID: 'session-test', ...extra } as SessionPrompt;
    await Effect.runPromise(registrations.prompt?.(event) ?? Effect.void);
    return event;
  };
  return { admit, prompted, registrations };
};

const textAfter = async (admission: Promise<SessionPrompt>): Promise<string> => {
  const event = await admission;
  return event.prompt.text;
};

describe('agent transform', () => {
  it('applies bundled roles and permissions without resetting host settings', async () => {
    const { registrations } = await load();
    const drafts = new Map<string, AgentDraft>();
    const update: AgentEditor['update'] = (id, edit) => {
      const draft =
        drafts.get(id) ?? Object.assign(Agent.Info.default(Agent.ID.make(id)), { steps: 7 });
      edit(draft);
      drafts.set(id, draft);
    };
    registrations.agent?.({
      default: () => {},
      get: (id) => drafts.get(id),
      list: () => [...drafts.values()],
      remove: () => {},
      update,
    });

    expect([...drafts.keys()].toSorted()).toEqual([
      'adventurer',
      'architect',
      'builder',
      'diagnose',
      'orchestrator',
      'planner',
      'reviewer',
      'writer',
    ]);
    const orchestrator = drafts.get('orchestrator');
    expect(orchestrator?.mode).toBe('all');
    expect(orchestrator?.permissions).toContainEqual({
      action: 'subagent',
      effect: 'allow',
      resource: 'builder',
    });
    for (const draft of drafts.values()) {
      expect(draft.system?.startsWith('---')).toBe(false);
      expect(draft.system).not.toContain('Auto-generated');
      expect(draft.steps).toBe(7);
    }
  });
});

describe('workflow commands', () => {
  it('submits the mode template with the invocation attachments and delivery', async () => {
    const { prompted, registrations } = await load();
    const commands: Command[] = [];
    registrations.command?.({
      add: (command) => {
        commands.push(command);
      },
    });
    expect(commands.map((command) => command.name)).toEqual(['fein', 'sonar', 'blitz']);
    expect(commands.every((command) => (command.description ?? '').length > 0)).toBe(true);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- branded IDs are irrelevant to submission.
    const invocation = {
      delivery: 'queue',
      prompt: {
        agents: [{ mention: { end: 8, start: 0, text: '@builder' }, name: 'builder' }],
        files: [{ mention: { end: 17, start: 9, text: '@plan.md' }, uri: 'file:///plan.md' }],
        skills: [{ id: 'docs-update', mention: { end: 30, start: 18, text: '$docs-update' } }],
        text: 'plan the work',
      },
      sessionID: 'session-1',
    } as unknown as CommandInvocation;
    await Effect.runPromise(commands[0].execute(invocation));

    expect(prompted).toHaveLength(1);
    expect(prompted[0]).toMatchObject({
      agents: [{ name: 'builder' }],
      delivery: 'queue',
      files: [{ uri: 'file:///plan.md' }],
      sessionID: 'session-1',
      skills: [{ id: 'docs-update' }],
    });
    expect(JSON.stringify(prompted[0])).not.toContain('mention');
    expect(String(prompted[0].text)).toMatch(
      /^\[MODE: fein\]\n\n## MODE: fein[\s\S]*\n\nplan the work$/u,
    );
    expect(invocation.prompt.agents?.[0].mention).toBeDefined();
  });
});

describe('skill transform', () => {
  it('adds bundled skills as body-only content at their package path', async () => {
    const { registrations } = await load();
    const skills = new Map<string, Skill.Info>();
    registrations.skill?.({
      add: (skill) => {
        skills.set(skill.id, skill);
      },
      get: (id) => skills.get(id),
      list: () => [...skills.values()],
      remove: () => {},
      update: () => {},
    });

    expect([...skills.keys()].toSorted()).toEqual(['create-pull-request', 'docs-update']);
    for (const [id, skill] of skills) {
      expect(skill.description?.length).toBeGreaterThan(0);
      expect(skill.path.endsWith(`skills/${id}/SKILL.md`)).toBe(true);
      expect(skill.content.startsWith('# ')).toBe(true);
    }
  });
});

describe('prompt admission', () => {
  it('expands each bare mode into its instructions and strips the trigger', async () => {
    const { admit } = await load();
    const texts = await Promise.all(
      ['fein', 'sonar', 'blitz'].map(async (mode) => [
        mode,
        await textAfter(admit(`${mode.toUpperCase()}: inspect the project`)),
      ]),
    );
    for (const [mode, text] of texts) {
      expect(text).toMatch(
        new RegExp(
          `^\\[MODE: ${mode}\\]\\n\\n## MODE: ${mode}[\\s\\S]*\\n\\ninspect the project$`,
          'u',
        ),
      );
    }
  });

  it('leaves code, disabled keywords, empty prompts, and expanded commands unchanged', async () => {
    const { admit } = await load({ modes: { disabledKeywords: ['sonar'] } });
    const expanded = await textAfter(admit('fein inspect'));
    const inputs = ['sonar inspect', '`fein`', '```\nblitz\n```', '', expanded];
    expect(await Promise.all(inputs.map(async (text) => await textAfter(admit(text))))).toEqual(
      inputs,
    );
  });

  it('falls back to default options when they are invalid', async () => {
    const { admit } = await load({ modes: { disabledKeywords: ['nope'] } });
    expect(await textAfter(admit('sonar inspect'))).toMatch(/^\[MODE: sonar\]/u);
  });

  it('mirrors display text and clears mention offsets invalidated by expansion', async () => {
    const { admit } = await load();
    const comments = [{ comment: 'Keep this note', path: 'README.md' }];
    const displayed = await admit('fein inspect', {
      metadata: { comments, displayText: 'fein inspect' },
    });
    expect(displayed.metadata?.displayText).toBe(displayed.prompt.text);
    expect(displayed.metadata?.comments).toBe(comments);

    const mention = { end: 18, start: 13, text: '@file' };
    const attached = await admit('', {
      prompt: {
        files: [{ mention, uri: 'file:///file' }],
        skills: [{ id: Skill.ID.make('docs-update'), mention }],
        text: 'fein inspect @file',
      },
    });
    expect(attached.prompt.files).toEqual([{ uri: 'file:///file' }]);
    expect(attached.prompt.skills).toEqual([{ id: Skill.ID.make('docs-update') }]);
  });
});

describe('model context', () => {
  it('adds global rules to agent-loop and compaction requests without rewriting history', async () => {
    const { registrations } = await load();
    const events = [registrations.context, registrations.compaction].map((hook) => {
      const messages = [{ content: [{ text: 'plain hello', type: 'text' }], role: 'user' }];
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook reads only system and messages.
      const event = {
        messages,
        sessionID: 'session-test',
        system: [],
      } as unknown as SessionContext;
      return { event, hook, messages };
    });
    await Promise.all(
      events.map(async ({ event, hook }) => {
        await Effect.runPromise(hook?.(event) ?? Effect.void);
      }),
    );
    for (const { event, messages } of events) {
      expect(event.system[0]?.type === 'text' && event.system[0].text).toContain(
        '# Global Agent Rules',
      );
      expect(messages[0].content[0].text).toBe('plain hello');
    }
  });
});
