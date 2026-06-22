import { describe, it, expect, vi } from 'vite-plus/test';
import { installCompactionHandlers } from '../src/compaction.js';
import { createInitialState } from '../src/state.js';

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
    it('returns compaction.summary containing the Goal section when activeTask is set', () => {
      const pi = createMockPi();
      let state = createInitialState();
      state = { ...state, activeTask: 'build the feature' };
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_compact')!;
      const result = handler();

      expect(result).toEqual({
        compaction: {
          summary: expect.stringContaining('**Goal:** build the feature'),
        },
      });
    });

    it('returns compaction.summary with mode and Goal sections', () => {
      const pi = createMockPi();
      const state = { ...createInitialState(), mode: 'fein' as const, activeTask: 'test task' };
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_compact')!;
      const result = handler();

      expect(typeof result.compaction.summary).toBe('string');
      expect(result.compaction.summary).toContain('**Mode:** FEIN');
      expect(result.compaction.summary).toContain('**Goal:** test task');
    });
  });

  describe('session_before_tree handler', () => {
    it('returns summary when userWantsSummary is true', () => {
      const pi = createMockPi();
      let state = createInitialState();
      state = { ...state, activeTask: 'analyze results' };
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_tree')!;
      const result = handler({ userWantsSummary: true });

      expect(result).toContain('**Goal:** analyze results');
    });

    it('returns undefined when userWantsSummary is false', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_tree')!;
      const result = handler({ userWantsSummary: false });

      expect(result).toBeUndefined();
    });

    it('returns undefined when userWantsSummary is absent', () => {
      const pi = createMockPi();
      const state = createInitialState();
      installCompactionHandlers(pi as any, state);

      const handler = pi.handlers.get('session_before_tree')!;
      const result = handler({});

      expect(result).toBeUndefined();
    });
  });
});
