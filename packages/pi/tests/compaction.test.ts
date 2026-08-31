import { describe, expect, it, vi } from 'vite-plus/test';

import { installCompactionHandlers } from '@/compaction.js';
import { createInitialState } from '@/state.js';

describe('installCompactionHandlers', () => {
  function createMockPi() {
    const handlers = new Map<string, (...args: any[]) => any>();
    return {
      handlers,
      on: vi.fn((event: string, handler: (...args: any[]) => any) => {
        handlers.set(event, handler);
      }),
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
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_compact')!;
      const result = handler(baseCompactEvent);

      expect(result).toEqual({
        compaction: {
          details: expect.any(Object),
          firstKeptEntryId: '',
          summary: expect.stringContaining('**Goal:** build the feature'),
          tokensBefore: 0,
        },
      });
    });

    it('returns compaction with mode and Goal sections', () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), activeTask: 'test task', mode: 'fein' as const };
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
