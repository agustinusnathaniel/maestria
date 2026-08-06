import { describe, expect, it } from 'vite-plus/test';
import {
  armLandingReview,
  beginLandingReview,
  createInitialState,
  markLandingReviewFailed,
  markLandingReviewShippingStarted,
  markLandingReviewStale,
  recordLandingReviewVerdict,
  resetLandingReview,
  validateLandingReviewVerdict,
} from '../src/state-core.js';
import type { LandingReviewVerdict } from '../src/state-core.js';

const artifactDigest = 'a'.repeat(64);
const resultDigest = 'b'.repeat(64);
const approvedVerdict: LandingReviewVerdict = {
  schema: 'maestria.landing-review.v1',
  verdict: 'approved',
  artifactDigest,
  findings: [],
};

describe('landing review state machine', () => {
  it('starts in execution and requires the armed then reviewing transitions', () => {
    let state = createInitialState();
    expect(state.landingReview).toBe('execution');

    state = armLandingReview(state, 'review-1', artifactDigest);
    expect(state.landingReview).toBe('armed');
    expect(state.landingReviewBinding?.invocationId).toBe('review-1');

    state = beginLandingReview(state, 'review-1');
    expect(state.landingReview).toBe('reviewing');
  });

  it('fails closed when the invocation identity does not match', () => {
    let state = beginLandingReview(
      armLandingReview(createInitialState(), 'review-1', artifactDigest),
      'review-2',
    );
    expect(state.landingReview).toBe('failed');
    expect(state.landingReviewFailureReason).toContain('did not match');
  });

  it('approves only a strict verdict bound to the artifact and result', () => {
    let state = beginLandingReview(
      armLandingReview(createInitialState(), 'review-1', artifactDigest),
      'review-1',
    );
    state = recordLandingReviewVerdict(state, approvedVerdict, artifactDigest, resultDigest);
    expect(state.landingReview).toBe('approved');
    expect(state.landingReviewBinding?.resultDigest).toBe(resultDigest);
  });

  it('rejects extra verdict fields and digest mismatches', () => {
    let state = beginLandingReview(
      armLandingReview(createInitialState(), 'review-1', artifactDigest),
      'review-1',
    );
    expect(
      validateLandingReviewVerdict(
        { ...approvedVerdict, extra: true },
        state.landingReviewBinding,
        artifactDigest,
        resultDigest,
      ).valid,
    ).toBe(false);
    state = recordLandingReviewVerdict(state, approvedVerdict, 'c'.repeat(64), resultDigest);
    expect(state.landingReview).toBe('stale');
  });

  it('keeps rejection, failure, and stale states non-shipping', () => {
    let state = beginLandingReview(
      armLandingReview(createInitialState(), 'review-1', artifactDigest),
      'review-1',
    );
    state = recordLandingReviewVerdict(
      state,
      { ...approvedVerdict, verdict: 'rejected', findings: ['major issue'] },
      artifactDigest,
      resultDigest,
    );
    expect(state.landingReview).toBe('rejected');
    expect(markLandingReviewFailed(state).landingReview).toBe('failed');
    expect(markLandingReviewStale(state).landingReview).toBe('stale');
  });

  it('records the first bounded shipping action only after approval', () => {
    let state = beginLandingReview(
      armLandingReview(createInitialState(), 'review-1', artifactDigest),
      'review-1',
    );
    state = recordLandingReviewVerdict(state, approvedVerdict, artifactDigest, resultDigest);
    expect(markLandingReviewShippingStarted(state).landingReviewShippingStarted).toBe(true);
    expect(
      markLandingReviewShippingStarted({ ...state, landingReview: 'reviewing' })
        .landingReviewShippingStarted,
    ).toBe(false);
  });

  it('marks an in-flight review stale instead of reopening execution on a new turn', () => {
    const state = beginLandingReview(
      armLandingReview(createInitialState(), 'review-1', artifactDigest),
      'review-1',
    );
    expect(resetLandingReview(state).landingReview).toBe('stale');
  });
});
