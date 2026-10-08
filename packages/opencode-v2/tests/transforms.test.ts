import { Effect } from 'effect';
import type { Scope } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import path from 'node:path';
import type { CommandInvocation } from '@opencode/plugin/effect/command';
import type { AgentEditor, CommandEditor, ReferenceEditor, SkillEditor } from '../src/types.js';
import { registerAgentTransforms } from '../src/transforms/agents.js';
import { registerCommandTransforms } from '../src/transforms/commands.js';
import { registerReferenceTransforms } from '../src/transforms/references.js';
import { registerSkillTransforms } from '../src/transforms/skills.js';

const runRegister = async (effect: Effect.Effect<void, never, Scope.Scope>): Promise<void> => {
  await Effect.runPromise(Effect.scoped(effect));
};

// Shared SDK Transform stub return: a no-op registration handle.
const registered = Effect.succeed({ dispose: Effect.void });

describe('registerReferenceTransforms', () => {
  it('adds the rules file once as a local reference source', async () => {
    type ReferenceSource = Parameters<ReferenceEditor['add']>[1];
    const added: { name: string; source: ReferenceSource }[] = [];
    const draft: ReferenceEditor = {
      add: (name, source) => {
        added.push({ name, source });
      },
      get: () => {},
      list: () => [],
      remove: () => {},
    };

    let captured: ((draft: ReferenceEditor) => void) | undefined;
    await runRegister(
      registerReferenceTransforms({
        reference: {
          // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy Transform<ReferenceEditor>.
          transform: (callback: (draft: ReferenceEditor) => void) => {
            captured = callback;
            return registered;
          },
        },
      }),
    );

    expect(captured).toBeTypeOf('function');
    captured?.(draft);

    expect(added).toHaveLength(1);
    expect(added[0].name).toBe('maestria.rules');
    if (added[0].source.type !== 'local') {
      throw new Error('expected a local reference source');
    }
    expect(added[0].source.path.endsWith(path.join('rules', 'AGENTS.md'))).toBe(true);
  });
});

describe('registerAgentTransforms', () => {
  it('updates exactly the 8 known agents, orchestrator first', async () => {
    const updated: string[] = [];
    const registry: AgentEditor = {
      default: () => {},
      get: () => {},
      list: () => [],
      remove: () => {},
      update: (id) => {
        updated.push(id);
      },
    };

    let captured: ((registry: AgentEditor) => void) | undefined;
    await runRegister(
      registerAgentTransforms({
        agent: {
          // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy Transform<AgentEditor>.
          transform: (callback: (registry: AgentEditor) => void) => {
            captured = callback;
            return registered;
          },
        },
      }),
    );
    expect(captured).toBeTypeOf('function');
    captured?.(registry);

    expect(updated).toHaveLength(8);
    expect(updated[0]).toBe('orchestrator');
    expect(updated.toSorted()).toEqual(
      [
        'adventurer',
        'architect',
        'builder',
        'diagnose',
        'orchestrator',
        'planner',
        'reviewer',
        'writer',
      ].toSorted(),
    );
  });
});

describe('registerCommandTransforms', () => {
  it('adds one code-style command per mode template', async () => {
    type CommandDefinition = Parameters<CommandEditor['add']>[0];
    const added: CommandDefinition[] = [];
    let captured: ((editor: { add: (def: CommandDefinition) => void }) => void) | undefined;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test double implements only the command/session surface the transform touches.
    const ctx = {
      command: {
        // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy it.
        transform: (callback: (editor: { add: (def: CommandDefinition) => void }) => void) => {
          captured = callback;
          return registered;
        },
      },
      session: {
        prompt: () => Effect.void,
      },
    } as unknown as Parameters<typeof registerCommandTransforms>[0];

    await runRegister(registerCommandTransforms(ctx));
    expect(captured).toBeTypeOf('function');
    captured?.({
      add: (def) => {
        added.push(def);
      },
    });

    expect(added.map((def) => def.name).toSorted()).toEqual(['blitz', 'fein', 'sonar']);
    for (const def of added) {
      expect(def.description?.length).toBeGreaterThan(0);
      expect(def.execute).toBeTypeOf('function');
    }
  });

  it('execute prepends the mode template and forwards session, text, and delivery', async () => {
    type CommandDefinition = Parameters<CommandEditor['add']>[0];
    const added: CommandDefinition[] = [];
    const prompted: {
      sessionID: unknown;
      text: unknown;
      delivery: unknown;
      files: unknown;
      agents: unknown;
      skills: unknown;
    }[] = [];
    let captured: ((editor: { add: (def: CommandDefinition) => void }) => void) | undefined;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test double implements only the command/session surface the transform touches.
    const ctx = {
      command: {
        // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy it.
        transform: (callback: (editor: { add: (def: CommandDefinition) => void }) => void) => {
          captured = callback;
          return registered;
        },
      },
      session: {
        prompt: (input: {
          sessionID: unknown;
          text: unknown;
          delivery: unknown;
          files: unknown;
          agents: unknown;
          skills: unknown;
        }) => {
          prompted.push(input);
          return Effect.void;
        },
      },
    } as unknown as Parameters<typeof registerCommandTransforms>[0];

    await runRegister(registerCommandTransforms(ctx));
    expect(captured).toBeTypeOf('function');
    captured?.({
      add: (def) => {
        added.push(def);
      },
    });
    const fein = added.find((def) => def.name === 'fein');
    expect(fein).toBeDefined();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- CommandInvocation carries branded session/message IDs the test does not need to mint.
    const invocation = {
      delivery: 'steer',
      prompt: {
        agents: [{ name: 'builder' }],
        files: [{ uri: 'file:///workspace/plan.md' }],
        skills: [{ id: 'review' }],
        text: 'plan the work',
      },
      sessionID: 'session-1',
    } as unknown as CommandInvocation;
    await Effect.runPromise(fein?.execute(invocation) ?? Effect.void);

    expect(prompted).toHaveLength(1);
    const submitted = String(prompted[0].text);
    expect(submitted.endsWith('plan the work')).toBe(true);
    expect(submitted.length).toBeGreaterThan('plan the work'.length);
    expect(submitted).toContain('fein');
    expect(prompted[0].delivery).toBe('steer');
    expect(prompted[0].sessionID).toBe('session-1');
    expect(prompted[0].files).toEqual([{ uri: 'file:///workspace/plan.md' }]);
    expect(prompted[0].agents).toEqual([{ name: 'builder' }]);
    expect(prompted[0].skills).toEqual([{ id: 'review' }]);
  });
});

describe('registerSkillTransforms', () => {
  it('registers every core skill with its file path and content, updating on re-run', async () => {
    type SkillInfo = Parameters<SkillEditor['add']>[0];
    const store = new Map<string, SkillInfo>();
    let updated = 0;
    const draft: SkillEditor = {
      add: (skill) => {
        store.set(skill.id, skill);
      },
      get: (id) => store.get(id),
      list: () => [],
      remove: () => {},
      update: (id, update) => {
        updated += 1;
        const current = store.get(id);
        if (current) {
          update(current);
        }
      },
    };

    let captured: ((draft: SkillEditor) => void) | undefined;
    await runRegister(
      registerSkillTransforms({
        skill: {
          // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy Transform<SkillEditor>.
          transform: (callback: (draft: SkillEditor) => void) => {
            captured = callback;
            return registered;
          },
        },
      }),
    );

    expect(captured).toBeTypeOf('function');
    captured?.(draft);

    expect(store.size).toBeGreaterThan(0);
    for (const [id, skill] of store) {
      expect(skill.path.endsWith(`${id}.md`)).toBe(true);
      expect(skill.content.length).toBeGreaterThan(0);
    }

    const sizeBefore = store.size;
    captured?.(draft);
    expect(store.size).toBe(sizeBefore);
    expect(updated).toBe(sizeBefore);
  });
});
