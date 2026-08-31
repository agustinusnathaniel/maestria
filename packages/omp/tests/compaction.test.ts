import { describe, expect, it, vi } from 'vite-plus/test';

import { installCompactionHandlers } from '@/compaction.js';
import { createInitialState } from '@/state.js';

interface CompactEvent {
  preparation?: {
    firstKeptEntryId?: string;
    tokensBefore?: number;
  };
}

interface CompactResult {
  compaction?: {
    details?: unknown;
    firstKeptEntryId: string;
    summary: string;
    tokensBefore: number;
  };
}

interface TreeEvent {
  preparation?: {
    userWantsSummary?: boolean;
  };
}

interface TreeResult {
  summary?: {
    details?: unknown;
    summary: string;
  };
}

type CompactHandler = (event: CompactEvent) => CompactResult;
type TreeHandler = (event: TreeEvent) => TreeResult | undefined;
type CompactionOn = (
  ...args: ['session_before_compact', CompactHandler] | ['session_before_tree', TreeHandler]
) => void;

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

interface MockPi {
  compactHandlers: Map<string, CompactHandler>;
  on: ReturnType<typeof vi.fn<CompactionOn>>;
  treeHandlers: Map<string, TreeHandler>;
}

describe('installCompactionHandlers', () => {
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

      const result = getCompactHandler(pi)(baseCompactEvent);

      const { compaction } = result;
      if (compaction === undefined) {
        throw new Error('Compaction result was not returned');
      }
      expect(compaction.firstKeptEntryId).toBe('');
      expect(compaction.summary).toContain('**Goal:** build the feature');
      expect(compaction.tokensBefore).toBe(0);
      expect(compaction.details).toEqual(state);
    });

    it('returns compaction with mode and Goal sections', () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), activeTask: 'test task', mode: 'fein' as const };
      installCompactionHandlers(pi, state);

      const result = getCompactHandler(pi)(baseCompactEvent);

      const { compaction } = result;
      if (compaction === undefined) {
        throw new Error('Compaction result was not returned');
      }
      expect(compaction.firstKeptEntryId).toBe('');
      expect(compaction.summary).toContain('**Mode:** FEIN');
      expect(compaction.summary).toContain('**Goal:** test task');
      expect(compaction.tokensBefore).toBe(0);
    });

    it('extracts firstKeptEntryId and tokensBefore from event.preparation', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi, state);

      const result = getCompactHandler(pi)({
        ...baseCompactEvent,
        preparation: {
          ...baseCompactEvent.preparation,
          firstKeptEntryId: 'entry-123',
          tokensBefore: 8192,
        },
      });

      expect(result).toMatchObject({
        compaction: { firstKeptEntryId: 'entry-123', tokensBefore: 8192 },
      });
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

      if (result?.summary === undefined) {
        throw new Error('Tree summary was not returned');
      }
      expect(result.summary.summary).toContain('**Goal:** analyze results');
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
