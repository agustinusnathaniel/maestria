import type { Route } from '@/modes/types.js';
import {
  LandingReviewStateMachine,
  type LandingReviewRecord,
  type LandingReviewVerdict,
  type WorktreeContentManifest,
} from '@/landing-review.js';

interface RouteSessionState {
  route: Route | null;
}

/**
 * In-memory state for root orchestrator sessions.
 *
 * Sessions are registered only after OpenCode identifies the active agent as
 * the Maestria orchestrator. Every user message starts a fresh, unselected
 * turn. Unknown sessions are intentionally absent so specialist and unrelated
 * sessions are never subject to the root route gate.
 */
export class RouteRegistry {
  private readonly sessions = new Map<string, RouteSessionState>();
  private readonly landingReviews = new LandingReviewStateMachine();

  beginTurn(sessionID: string): void {
    if (!sessionID) return;
    this.sessions.set(sessionID, { route: null });
    this.landingReviews.reset(sessionID);
  }

  select(sessionID: string, route: Route): void {
    const state = this.sessions.get(sessionID);
    if (!state) {
      throw new Error('[maestria] Cannot select a route for an unregistered session.');
    }

    if (route === 'landing-review') {
      if (state.route !== 'direct') {
        throw new Error(
          '[maestria] Landing review is only available as a one-way transition from "direct".',
        );
      }

      state.route = route;
      this.landingReviews.arm(sessionID);
      return;
    }

    if (state.route === 'landing-review') {
      throw new Error(
        '[maestria] Landing review is one-way; the root cannot return to a workflow route.',
      );
    }

    if (state.route !== null && state.route !== route) {
      throw new Error(
        `[maestria] Route already selected as "${state.route}" for this turn; ` +
          `cannot reselect "${route}".`,
      );
    }

    state.route = route;
  }

  claimLandingReview(sessionID: string): void {
    this.landingReviews.claimReviewer(sessionID);
  }

  setLandingReviewDigest(sessionID: string, digest: string): void {
    this.landingReviews.setArtifactDigest(sessionID, digest);
  }

  setLandingReviewManifest(sessionID: string, manifest: WorktreeContentManifest): void {
    this.landingReviews.setArtifactManifest(sessionID, manifest);
  }

  bindLandingReviewReviewer(sessionID: string, reviewerSessionID: string): void {
    this.landingReviews.bindReviewer(sessionID, reviewerSessionID);
  }

  completeLandingReview(
    sessionID: string,
    reviewerSessionID: string,
    verdict: LandingReviewVerdict,
    currentDigest: string,
    currentManifest?: WorktreeContentManifest,
  ): LandingReviewRecord['state'] {
    return this.landingReviews.complete(
      sessionID,
      reviewerSessionID,
      verdict,
      currentDigest,
      currentManifest,
    );
  }

  invalidateLandingReviewIfChanged(
    sessionID: string,
    currentDigest: string,
    currentManifest?: WorktreeContentManifest,
  ): boolean {
    return this.landingReviews.invalidateIfChanged(sessionID, currentDigest, currentManifest);
  }

  failLandingReview(sessionID: string): void {
    this.landingReviews.fail(sessionID);
  }

  getLandingReview(sessionID: string): LandingReviewRecord | undefined {
    return this.landingReviews.get(sessionID);
  }

  get(sessionID: string): Route | null | undefined {
    return this.sessions.get(sessionID)?.route;
  }

  isRootSession(sessionID: string): boolean {
    return this.sessions.has(sessionID);
  }

  clear(sessionID: string): void {
    this.sessions.delete(sessionID);
    this.landingReviews.clear(sessionID);
  }

  clearAll(): void {
    this.sessions.clear();
    this.landingReviews.clearAll();
  }
}
