import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import path from 'node:path';
import type { AgentDraft, ReferenceDraft } from '../src/types.js';
import { registerAgentTransforms } from '../src/transforms/agents.js';
import { registerReferenceTransforms } from '../src/transforms/references.js';

describe('registerReferenceTransforms', () => {
  it('adds the rules file once as a local reference source', async () => {
    type ReferenceSource = Parameters<ReferenceDraft['add']>[1];
    const added: { name: string; source: ReferenceSource }[] = [];
    const draft: ReferenceDraft = {
      add: (name, source) => {
        added.push({ name, source });
      },
      list: () => [],
      remove: () => {},
    };

    let captured: ((draft: ReferenceDraft) => void) | undefined;
    await Effect.runPromise(
      Effect.scoped(
        registerReferenceTransforms({
          reference: {
            // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy Transform<ReferenceDraft>.
            transform: (callback: (draft: ReferenceDraft) => void) => {
              captured = callback;
              return Effect.succeed({
                dispose: Effect.void,
              });
            },
          },
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
    expect(added[0].source.path.endsWith(path.join('rules', 'AGENTS.md'))).toBe(true);
  });
});

describe('registerAgentTransforms', () => {
  it('updates exactly the 8 known agents, orchestrator first', async () => {
    const updated: string[] = [];
    const registry: AgentDraft = {
      default: () => {},
      get: () => {},
      list: () => [],
      remove: () => {},
      update: (id) => {
        updated.push(id);
      },
    };

    let captured: ((registry: AgentDraft) => void) | undefined;
    await Effect.runPromise(
      Effect.scoped(
        registerAgentTransforms({
          agent: {
            // oxlint-disable-next-line promise/prefer-await-to-callbacks -- test double must implement the SDK Transform callback signature; an async function would not satisfy Transform<AgentDraft>.
            transform: (callback: (registry: AgentDraft) => void) => {
              captured = callback;
              return Effect.succeed({
                dispose: Effect.void,
              });
            },
          },
        }),
      ),
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
