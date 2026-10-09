import { Effect } from 'effect';
import type { Scope } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import type { CommandInvocation } from '@opencode/plugin/effect/command';
import type { CommandEditor, SkillEditor } from '../src/types.js';
import { registerCommandTransforms } from '../src/transforms/commands.js';
import { registerSkillTransforms } from '../src/transforms/skills.js';

const runRegister = async (effect: Effect.Effect<void, never, Scope.Scope>): Promise<void> => {
  await Effect.runPromise(Effect.scoped(effect));
};

// Shared SDK Transform stub return: a no-op registration handle.
const registered = Effect.succeed({ dispose: Effect.void });

describe('registerCommandTransforms', () => {
  type CommandDefinition = Parameters<CommandEditor['add']>[0];
  interface PromptedInput {
    sessionID: unknown;
    text: unknown;
    delivery: unknown;
    files: unknown;
    agents: unknown;
    skills: unknown;
  }

  // Single constructor for the command/session double both tests need:
  // captures the transform callback, runs registration, replays the callback
  // into a collecting editor, and returns what was added. Keeps the SDK
  // Transform signature tracked in one place instead of two.
  const setupCommandCapture = async (
    onPrompt: (input: PromptedInput) => void,
  ): Promise<CommandDefinition[]> => {
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
        prompt: (input: PromptedInput) => {
          onPrompt(input);
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
    return added;
  };

  it('adds one code-style command per mode template', async () => {
    const added = await setupCommandCapture(() => {});

    expect(added.map((def) => def.name).toSorted()).toEqual(['blitz', 'fein', 'sonar']);
    for (const def of added) {
      expect(def.description?.length).toBeGreaterThan(0);
      expect(def.execute).toBeTypeOf('function');
    }
  });

  it('execute prepends the mode template and forwards session, text, and delivery', async () => {
    const prompted: PromptedInput[] = [];
    const added = await setupCommandCapture((input) => {
      prompted.push(input);
    });
    const fein = added.find((def) => def.name === 'fein');
    expect(fein).toBeDefined();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- CommandInvocation carries branded session/message IDs the test does not need to mint.
    const invocation = {
      delivery: 'steer',
      prompt: {
        agents: [{ mention: { end: 8, start: 0, text: '@builder' }, name: 'builder' }],
        files: [
          { mention: { end: 17, start: 9, text: '@plan.md' }, uri: 'file:///workspace/plan.md' },
        ],
        skills: [{ id: 'review', mention: { end: 25, start: 18, text: '$review' } }],
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
    expect(invocation.prompt.agents?.[0].mention).toBeDefined();
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
      // Pushed content is the Markdown body: the sync header and the
      // frontmatter block must never leak into the conversation.
      expect(skill.content.startsWith('<!--')).toBe(false);
      expect(skill.content.startsWith('---')).toBe(false);
    }
    // Frontmatter path (not the heading fallback): the canonical description
    // survives sync into the registered skill.
    expect(store.get('handoff')?.description).toBe(
      'Decide when a handoff is needed and what outcome-only context it must carry',
    );

    const sizeBefore = store.size;
    captured?.(draft);
    expect(store.size).toBe(sizeBefore);
    expect(updated).toBe(sizeBefore);
  });
});
