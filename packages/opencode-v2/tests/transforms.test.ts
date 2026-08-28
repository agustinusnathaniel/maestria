import { Effect } from 'effect';
import { describe, it, expect } from 'vite-plus/test';
import { join } from 'node:path';
import type { AgentDraft, ReferenceDraft } from '../src/types.js';
import { registerAgentTransforms } from '../src/transforms/agents.js';
import { registerReferenceTransforms } from '../src/transforms/references.js';

describe('registerReferenceTransforms', () => {
  it('adds the rules file once as a local reference source', async () => {
    type ReferenceSource = Parameters<ReferenceDraft['add']>[1];
    const added: Array<{ name: string; source: ReferenceSource }> = [];
    const draft: ReferenceDraft = {
      add: (name, source) => {
        added.push({ name, source });
      },
      remove: () => {},
      list: () => [],
    };

    let captured: ((draft: ReferenceDraft) => void) | undefined;
    await Effect.runPromise(
      Effect.scoped(
        registerReferenceTransforms({
          reference: {
            transform: (callback: (draft: ReferenceDraft) => void) => {
              captured = callback;
              return Effect.succeed({
                dispose: Effect.void,
              } as unknown as import('../src/types.js').Registration);
            },
          },
        } as unknown as {
          reference: { transform: import('../src/types.js').Transform<ReferenceDraft> };
        }),
      ),
    );

    expect(captured).toBeTypeOf('function');
    captured?.(draft);

    expect(added).toHaveLength(1);
    expect(added[0].name).toBe('maestria.rules');
    if (added[0].source.type !== 'local') {
      throw new Error('expected a local reference source');
    }
    expect(added[0].source.path.endsWith(join('rules', 'AGENTS.md'))).toBe(true);
  });
});

describe('registerAgentTransforms', () => {
  it('updates exactly the 8 known agents, orchestrator first', async () => {
    const updated: string[] = [];
    const registry: AgentDraft = {
      update: (id) => {
        updated.push(id);
      },
      get: () => undefined,
      list: () => [],
      default: () => {},
      remove: () => {},
    };

    let captured: ((registry: AgentDraft) => void) | undefined;
    await Effect.runPromise(
      Effect.scoped(
        registerAgentTransforms({
          agent: {
            transform: (callback: (registry: AgentDraft) => void) => {
              captured = callback;
              return Effect.succeed({
                dispose: Effect.void,
              } as unknown as import('../src/types.js').Registration);
            },
          },
        } as unknown as { agent: { transform: import('../src/types.js').Transform<AgentDraft> } }),
      ),
    );
    expect(captured).toBeTypeOf('function');
    captured?.(registry);

    expect(updated).toHaveLength(8);
    expect(updated[0]).toBe('orchestrator');
    expect([...updated].sort()).toEqual(
      [
        'adventurer',
        'architect',
        'builder',
        'diagnose',
        'orchestrator',
        'planner',
        'reviewer',
        'writer',
      ].sort(),
    );
  });
});
