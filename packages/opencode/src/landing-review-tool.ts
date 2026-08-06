import { tool, type PluginInput, type ToolContext, type ToolDefinition } from '@opencode-ai/plugin';
import type { ArtifactClient } from '@/landing-review.js';
import { computeArtifactManifest, parseLandingReviewVerdict } from '@/landing-review.js';
import { LANDING_REVIEW_TOOL } from '@/route-gate.js';
import { RouteRegistry } from '@/route-registry.js';

const REVIEWER_AGENT = 'reviewer';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function responseData(value: unknown): unknown {
  if (isRecord(value) && 'data' in value) return value.data;
  return value;
}

function extractStrictVerdict(response: unknown) {
  if (!isRecord(response) || !Array.isArray(response.parts) || response.parts.length !== 1) {
    return undefined;
  }
  const part = response.parts[0];
  if (!isRecord(part) || part.type !== 'text' || typeof part.text !== 'string') return undefined;

  try {
    return parseLandingReviewVerdict(JSON.parse(part.text));
  } catch {
    return undefined;
  }
}

function isTrustedChild(
  value: unknown,
  rootSessionID: string,
): value is { id: string; parentID: string } {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.parentID === rootSessionID
  );
}

/**
 * Create the only tool which can move an armed direct turn into review and
 * approved shipping. The child is created through the installed SDK, not via
 * a model-visible task dispatch.
 */
export function createMaestriaLandingReviewTool(
  registry: RouteRegistry,
  client: PluginInput['client'],
): ToolDefinition {
  return tool({
    description:
      'Create exactly one trusted reviewer child for the current direct artifact. ' +
      'Shipping remains blocked unless the child returns the strict approved verdict.',
    args: {},
    execute: async (_args, context: ToolContext) => {
      if (context.agent !== 'orchestrator' || !registry.isRootSession(context.sessionID)) {
        throw new Error(`[maestria] ${LANDING_REVIEW_TOOL} is root-orchestrator only.`);
      }

      registry.claimLandingReview(context.sessionID);

      try {
        const artifactManifest = await computeArtifactManifest(
          client as unknown as ArtifactClient,
          context.sessionID,
          context.directory,
        );
        const artifactDigest = artifactManifest.digest;
        registry.setLandingReviewManifest(context.sessionID, artifactManifest);

        const child = responseData(
          await client.session.create({
            body: {
              parentID: context.sessionID,
              title: 'Maestria landing review',
            },
            query: { directory: context.directory },
          }),
        );
        if (!isTrustedChild(child, context.sessionID)) {
          throw new Error('[maestria] Reviewer child identity or parent binding was invalid.');
        }
        registry.bindLandingReviewReviewer(context.sessionID, child.id);

        const response = responseData(
          await client.session.prompt({
            path: { id: child.id },
            query: { directory: context.directory },
            body: {
              agent: REVIEWER_AGENT,
              parts: [
                {
                  type: 'text',
                  text: [
                    'Review the current workspace artifact as an independent checker.',
                    'Do not edit files, create children, commit, push, or create a PR.',
                    `The root session is ${context.sessionID}.`,
                    `The artifact digest is ${artifactDigest}.`,
                    'Return exactly one JSON object and no markdown or additional text:',
                    '{"verdict":"approved|rejected","artifactDigest":"64 lowercase hex characters","summary":"string","findings":["string"]}',
                    'Use approved only when the artifact is safe to land. Echo the digest exactly.',
                  ].join('\n'),
                },
              ],
            },
          }),
        );

        if (
          !isRecord(response) ||
          !isRecord(response.info) ||
          response.info.sessionID !== child.id
        ) {
          throw new Error('[maestria] Reviewer response identity was invalid.');
        }
        const verdict = extractStrictVerdict(response);
        if (!verdict) throw new Error('[maestria] Reviewer returned a malformed JSON verdict.');

        const currentManifest = await computeArtifactManifest(
          client as unknown as ArtifactClient,
          context.sessionID,
          context.directory,
        );
        const state = registry.completeLandingReview(
          context.sessionID,
          child.id,
          verdict,
          currentManifest.digest,
          currentManifest,
        );
        if (state !== 'approved') {
          throw new Error(`[maestria] Landing review did not approve shipping (${state}).`);
        }

        return {
          title: 'Landing review approved',
          output: `Reviewer approved artifact ${artifactDigest}. Only approved shipping commands are now available.`,
          metadata: { state, artifactDigest, reviewerSessionID: child.id },
        };
      } catch (error) {
        registry.failLandingReview(context.sessionID);
        throw error;
      }
    },
  });
}
