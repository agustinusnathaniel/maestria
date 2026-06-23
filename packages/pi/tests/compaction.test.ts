import { describe, it, expect, vi } from 'vite-plus/test';
import { installCompactionHandlers } from '@/compaction.js';
import { createInitialState } from '@/state.js';

describe('installCompactionHandlers', () => {
  function createMockPi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    return {
      on: vi.fn((event: string, handler: (...args: any[]) => any) => {
        handlers.set(event, handler);
      }),
      handlers,
    };
  }

  it('registers session_before_compact handler', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installCompactionHandlers(pi as any, state);

    expect(pi.on).toHaveBeenCalledWith('session_before_compact', expect.any(Function));
  });

  it('registers session_before_tree handler', () => {
    const pi = createMockPi();
    const state = createInitialState();

    installCompactionHandlers(pi as any, state);

    expect(pi.on).toHaveBeenCalledWith('session_before_tree', expect.any(Function));
  });

  describe('session_before_compact handler', () => {
    const baseCompactEvent = {
      type: 'session_before_compact' as const,
      preparation: {
        firstKeptEntryId: '',
        messagesToSummarize: [],
        turnPrefixMessages: [],
        isSplitTurn: false,
        tokensBefore: 0,
        fileOps: { reads: [], writes: [] },
        settings: { enabled: true, reserveTokens: 0, keepRecentTokens: 0 },
      },
      branchEntries: [],
      signal: new AbortController().signal,
    };

    it('returns compaction.summary containing the Goal section when activeTask is set', () => {
      const pi = createMockPi();
      let state = createInitialState();
      state = { ...state, activeTask: 'build the feature' };
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_compact')!;
      const result = handler(baseCompactEvent);

      expect(result).toEqual({
        compaction: {
          summary: expect.stringContaining('**Goal:** build the feature'),
          firstKeptEntryId: '',
          tokensBefore: 0,
        },
      });
    });

    it('returns compaction with mode and Goal sections', () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), mode: 'fein' as const, activeTask: 'test task' };
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_compact')!;
      const result = handler(baseCompactEvent);

      expect(typeof result.compaction.summary).toBe('string');
      expect(result.compaction.summary).toContain('**Mode:** FEIN');
      expect(result.compaction.summary).toContain('**Goal:** test task');
      expect(result.compaction).toHaveProperty('firstKeptEntryId');
      expect(result.compaction).toHaveProperty('tokensBefore');
    });

    it('extracts firstKeptEntryId and tokensBefore from event.preparation', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_compact')!;
      const result = handler({
        ...baseCompactEvent,
        preparation: {
          ...baseCompactEvent.preparation,
          firstKeptEntryId: 'entry-123',
          tokensBefore: 8192,
        },
      });

      expect(result.compaction.firstKeptEntryId).toBe('entry-123');
      expect(result.compaction.tokensBefore).toBe(8192);
    });
  });

  describe('session_before_tree handler', () => {
    const baseTreeEvent = {
      type: 'session_before_tree' as const,
      preparation: {
        targetId: 'test',
        oldLeafId: null,
        commonAncestorId: null,
        entriesToSummarize: [],
        userWantsSummary: false,
      },
      signal: new AbortController().signal,
    };

    it('returns summary when preparation.userWantsSummary is true', () => {
      const pi = createMockPi();
      let state = createInitialState();
      state = { ...state, activeTask: 'analyze results' };
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_tree')!;
      const result = handler({
        ...baseTreeEvent,
        preparation: { ...baseTreeEvent.preparation, userWantsSummary: true },
      });

      expect(result).toEqual({
        summary: {
          summary: expect.stringContaining('**Goal:** analyze results'),
        },
      });
    });

    it('returns undefined when preparation.userWantsSummary is false', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_tree')!;
      const result = handler({
        ...baseTreeEvent,
        preparation: { ...baseTreeEvent.preparation, userWantsSummary: false },
      });

      expect(result).toBeUndefined();
    });
  });
});
