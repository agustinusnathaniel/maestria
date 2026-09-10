import { describe, expect, it, vi } from 'vite-plus/test';

import { cycleToReviewModel, restoreOriginalState } from '../src/review-core.js';
import { createInitialState } from '../src/state-core.js';
import type { MaestriaState } from '../src/state-core.js';

interface MockCtx {
  modelRegistry: { getAll: () => { id: string }[] };
  ui: { notify: ReturnType<typeof vi.fn<(message: string) => void>> };
}

const createMockCtx = (models: { id: string }[] = [{ id: 'original-model' }]): MockCtx => ({
  modelRegistry: { getAll: vi.fn(() => models) },
  ui: { notify: vi.fn<(message: string) => void>() },
});

const createMockPi = () => ({
  setActiveTools: vi.fn<(tools: string[]) => void>(),
  setModel: vi.fn<(model: unknown) => Promise<void>>().mockResolvedValue(),
});

describe('restoreOriginalState', () => {
  it('restores original tools and model and clears review fields', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'original-model',
      originalTools: ['read', 'edit'],
      reviewMode: true,
    };

    await restoreOriginalState(pi, createMockCtx(), state);

    expect(pi.setActiveTools).toHaveBeenCalledWith(['read', 'edit']);
    expect(pi.setModel).toHaveBeenCalledWith({ id: 'original-model' });
    expect(state.reviewMode).toBe(false);
    expect(state.originalModel).toBeNull();
    expect(state.originalTools).toBeNull();
  });

  it('skips tool restoration when no original tools were saved', async () => {
    const pi = createMockPi();
    const state: MaestriaState = { ...createInitialState(), reviewMode: true };

    await restoreOriginalState(pi, createMockCtx(), state);

    expect(pi.setActiveTools).not.toHaveBeenCalled();
    expect(pi.setModel).not.toHaveBeenCalled();
  });

  it('skips model restoration when the original model is absent', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: '',
      originalTools: ['read'],
      reviewMode: true,
    };

    await restoreOriginalState(pi, createMockCtx(), state);

    expect(pi.setActiveTools).toHaveBeenCalledWith(['read']);
    expect(pi.setModel).not.toHaveBeenCalled();
  });

  it('does not switch models that are absent from the registry', async () => {
    const pi = createMockPi();
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'missing-model',
      reviewMode: true,
    };

    await restoreOriginalState(pi, createMockCtx([{ id: 'other-model' }]), state);

    expect(pi.setModel).not.toHaveBeenCalled();
    expect(state.reviewMode).toBe(false);
  });

  it('swallows registry failures while still clearing review state', async () => {
    const pi = createMockPi();
    const ctx = createMockCtx();
    ctx.modelRegistry.getAll = vi.fn(() => {
      throw new Error('registry unavailable');
    });
    const state: MaestriaState = {
      ...createInitialState(),
      originalModel: 'original-model',
      reviewMode: true,
    };

    await expect(restoreOriginalState(pi, ctx, state)).resolves.toBeUndefined();

    expect(state.reviewMode).toBe(false);
    expect(state.originalModel).toBeNull();
  });
});

describe('cycleToReviewModel', () => {
  it('returns null when no review model is configured', async () => {
    const pi = createMockPi();

    await expect(cycleToReviewModel(pi, createMockCtx(), createInitialState())).resolves.toBeNull();
    expect(pi.setModel).not.toHaveBeenCalled();
  });

  it('switches to the configured review model and returns its id', async () => {
    const pi = createMockPi();
    const state: MaestriaState = { ...createInitialState(), reviewModel: 'review-model' };

    const result = await cycleToReviewModel(
      pi,
      createMockCtx([{ id: 'original-model' }, { id: 'review-model' }]),
      state,
    );

    expect(result).toBe('review-model');
    expect(pi.setModel).toHaveBeenCalledWith({ id: 'review-model' });
  });

  it('notifies and returns null when the review model is not registered', async () => {
    const pi = createMockPi();
    const ctx = createMockCtx([{ id: 'original-model' }]);
    const state: MaestriaState = { ...createInitialState(), reviewModel: 'missing-model' };

    const result = await cycleToReviewModel(pi, ctx, state);

    expect(result).toBeNull();
    expect(pi.setModel).not.toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('not found in registry'));
  });

  it('notifies and returns null when the registry throws', async () => {
    const pi = createMockPi();
    const ctx = createMockCtx();
    ctx.modelRegistry.getAll = vi.fn(() => {
      throw new Error('registry unavailable');
    });
    const state: MaestriaState = { ...createInitialState(), reviewModel: 'review-model' };

    const result = await cycleToReviewModel(pi, ctx, state);

    expect(result).toBeNull();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Could not switch'));
  });

  it('notifies and returns null when the model switch rejects', async () => {
    const pi = createMockPi();
    pi.setModel.mockRejectedValue(new Error('no key'));
    const ctx = createMockCtx([{ id: 'review-model' }]);
    const state: MaestriaState = { ...createInitialState(), reviewModel: 'review-model' };

    const result = await cycleToReviewModel(pi, ctx, state);

    expect(result).toBeNull();
    expect(pi.setModel).toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('Could not switch'));
  });
});
