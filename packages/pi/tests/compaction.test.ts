import { describe, expect, it, vi } from 'vite-plus/test';

import { installCompactionHandlers } from '@/compaction.js';
import type {
  CompactionEvent,
  CompactionOn,
  CompactionResult,
  TreeEvent,
  TreeResult,
} from '@maestria/shared-pi/compaction-core';
import { createInitialState } from '@/state.js';

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

const getTreeSummary = (result: TreeResult | undefined): NonNullable<TreeResult['summary']> => {
  if (result?.summary === undefined) {
    throw new Error('Tree summary was not returned');
  }
  return result.summary;
};

const getCompaction = (result: CompactionResult): NonNullable<CompactionResult['compaction']> => {
  if (result.compaction === undefined) {
    throw new Error('Compaction result was not returned');
  }
  return result.compaction;
};

describe('installCompactionHandlers', () => {
  it('registers session_before_compact handler', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installCompactionHandlers(pi, state);

    expect(pi.on).toHaveBeenCalledWith('session_before_compact', expect.any(Function));
  });

  it('registers session_before_tree handler', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installCompactionHandlers(pi, state);

    expect(pi.on).toHaveBeenCalledWith('session_before_tree', expect.any(Function));
  });

  describe('session_before_compact handler', () => {
    const baseCompactEvent = {
      branchEntries: [],
      preparation: {
        fileOps: { reads: [], writes: [] },
        firstKeptEntryId: '',
        isSplitTurn: false,
        messagesToSummarize: [],
        settings: { enabled: true, keepRecentTokens: 0, reserveTokens: 0 },
        tokensBefore: 0,
        turnPrefixMessages: [],
      },
      signal: new AbortController().signal,
      type: 'session_before_compact' as const,
    };

    it('returns compaction.summary containing the Goal section when activeTask is set', () => {
      const pi = createMockPi();
      let state = createInitialState();
      state = { ...state, activeTask: 'build the feature' };
      installCompactionHandlers(pi, state);

      const result = getCompaction(getCompactHandler(pi)(baseCompactEvent));

      expect(result.firstKeptEntryId).toBe('');
      expect(result.summary).toContain('**Goal:** build the feature');
      expect(result.tokensBefore).toBe(0);
      expect(result.details).toEqual(state);
    });

    it('returns compaction with mode and Goal sections', () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), activeTask: 'test task', mode: 'fein' as const };
      installCompactionHandlers(pi, state);

      const result = getCompaction(getCompactHandler(pi)(baseCompactEvent));

      expect(typeof result.summary).toBe('string');
      expect(result.summary).toContain('**Mode:** FEIN');
      expect(result.summary).toContain('**Goal:** test task');
      expect(result.firstKeptEntryId).toBe('');
      expect(result.tokensBefore).toBe(0);
    });

    it('extracts firstKeptEntryId and tokensBefore from event.preparation', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi, state);

      const result = getCompaction(
        getCompactHandler(pi)({
          ...baseCompactEvent,
          preparation: {
            ...baseCompactEvent.preparation,
            firstKeptEntryId: 'entry-123',
            tokensBefore: 8192,
          },
        }),
      );

      expect(result.firstKeptEntryId).toBe('entry-123');
      expect(result.tokensBefore).toBe(8192);
    });
  });

  describe('session_before_tree handler', () => {
    const baseTreeEvent = {
      preparation: {
        commonAncestorId: null,
        entriesToSummarize: [],
        oldLeafId: null,
        targetId: 'test',
        userWantsSummary: false,
      },
      signal: new AbortController().signal,
      type: 'session_before_tree' as const,
    };

    it('returns summary when preparation.userWantsSummary is true', () => {
      const pi = createMockPi();
      let state = createInitialState();
      state = { ...state, activeTask: 'analyze results' };
      installCompactionHandlers(pi, state);

      const result = getTreeHandler(pi)({
        ...baseTreeEvent,
        preparation: { ...baseTreeEvent.preparation, userWantsSummary: true },
      });

      expect(getTreeSummary(result).summary).toContain('**Goal:** analyze results');
    });

    it('returns undefined when preparation.userWantsSummary is false', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi, state);

      const result = getTreeHandler(pi)({
        ...baseTreeEvent,
        preparation: { ...baseTreeEvent.preparation, userWantsSummary: false },
      });

      expect(result).toBeUndefined();
    });
  });
});
