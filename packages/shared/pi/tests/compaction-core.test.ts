import { describe, expect, it, vi } from 'vite-plus/test';

import { installCompactionHandlers } from '../src/compaction-core.js';
import type {
  CompactionEvent,
  CompactionOn,
  CompactionResult,
  TreeEvent,
  TreeResult,
} from '../src/compaction-core.js';
import { createInitialState } from '../src/state-core.js';

type CompactHandler = (event: CompactionEvent) => CompactionResult;
type TreeHandler = (event: TreeEvent) => TreeResult | undefined;

interface MockPi {
  compactHandlers: Map<string, CompactHandler>;
  on: ReturnType<typeof vi.fn<CompactionOn>>;
  treeHandlers: Map<string, TreeHandler>;
}

const createMockPi = (): MockPi => {
  const compactHandlers = new Map<string, CompactHandler>();
  const treeHandlers = new Map<string, TreeHandler>();
  return {
    compactHandlers,
    on: vi.fn<CompactionOn>((...args) => {
      const [event, handler] = args;
      if (event === 'session_before_compact') {
        compactHandlers.set(event, handler);
      } else {
        treeHandlers.set(event, handler);
      }
    }),
    treeHandlers,
  };
};

const getCompactHandler = (pi: MockPi): CompactHandler => {
  const handler = pi.compactHandlers.get('session_before_compact');
  if (handler === undefined) {
    throw new Error('session_before_compact handler was not registered');
  }
  return handler;
};

const getTreeHandler = (pi: MockPi): TreeHandler => {
  const handler = pi.treeHandlers.get('session_before_tree');
  if (handler === undefined) {
    throw new Error('session_before_tree handler was not registered');
  }
  return handler;
};

const getCompaction = (result: CompactionResult): NonNullable<CompactionResult['compaction']> => {
  if (result.compaction === undefined) {
    throw new Error('Compaction result was not returned');
  }
  return result.compaction;
};

const getTreeSummary = (result: TreeResult | undefined): NonNullable<TreeResult['summary']> => {
  if (result?.summary === undefined) {
    throw new Error('Tree summary was not returned');
  }
  return result.summary;
};

describe('installCompactionHandlers', () => {
  it('registers the compact and tree handlers', () => {
    const pi = createMockPi();

    installCompactionHandlers(pi, createInitialState());

    expect(pi.on).toHaveBeenCalledWith('session_before_compact', expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith('session_before_tree', expect.any(Function));
  });

  it('returns compaction details carrying the current state and summary', () => {
    const pi = createMockPi();
    const state = {
      ...createInitialState(),
      activeTask: 'build the feature',
      mode: 'fein' as const,
    };
    installCompactionHandlers(pi, state);

    const result = getCompaction(
      getCompactHandler(pi)({ preparation: { firstKeptEntryId: 'entry-123', tokensBefore: 8192 } }),
    );

    expect(result.details).toEqual(state);
    expect(result.summary).toContain('**Mode:** FEIN');
    expect(result.summary).toContain('**Goal:** build the feature');
    expect(result.firstKeptEntryId).toBe('entry-123');
    expect(result.tokensBefore).toBe(8192);
  });

  it('defaults compaction fields when preparation is absent', () => {
    const pi = createMockPi();
    installCompactionHandlers(pi, createInitialState());

    const result = getCompaction(getCompactHandler(pi)({}));

    expect(result.firstKeptEntryId).toBe('');
    expect(result.tokensBefore).toBe(0);
  });

  it('returns a tree summary only when the user wants one', () => {
    const pi = createMockPi();
    const state = { ...createInitialState(), activeTask: 'analyze results' };
    installCompactionHandlers(pi, state);

    const summaryResult = getTreeHandler(pi)({ preparation: { userWantsSummary: true } });
    expect(getTreeSummary(summaryResult).summary).toContain('**Goal:** analyze results');

    expect(getTreeHandler(pi)({ preparation: { userWantsSummary: false } })).toBeUndefined();
    expect(getTreeHandler(pi)({})).toBeUndefined();
  });
});
