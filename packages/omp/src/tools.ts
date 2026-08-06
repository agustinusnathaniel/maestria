import type { ExtensionAPI, ToolCallEvent, ExtensionContext } from '@oh-my-pi/pi-coding-agent';
import type { TaskToolDetails } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import {
  DANGEROUS_PATTERNS,
  getModeToolBlockReason,
  isLandingReviewDispatch,
  isLandingReviewShippingCommand,
  isLandingReviewShippingCommandOnNonPrimaryBranch,
  isLandingReviewShippingMutation,
} from '@maestria/shared-pi/tools-core';
import {
  captureWorktreeContentManifest,
  sameWorktreeContentManifest,
  sha256Hex,
  type WorktreeContentManifest,
} from '@maestria/shared-pi/manifest-core';
import type { ModeController } from '@maestria/shared-pi/modes-core';
import {
  armLandingReview,
  beginLandingReview,
  LANDING_REVIEW_VERDICT_INSTRUCTIONS,
  markLandingReviewFailed,
  markLandingReviewShippingStarted,
  markLandingReviewStale,
  persistState,
  recordLandingReviewVerdict,
} from '@/state.js';

// Note: omp's @oh-my-pi/pi-coding-agent does not export isToolCallEventType,
// so we use direct event.toolName string comparison instead.

const LANDING_REVIEW_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'verdict', 'artifactDigest', 'findings'],
  properties: {
    schema: { const: 'maestria.landing-review.v1' },
    verdict: { enum: ['approved', 'rejected'] },
    artifactDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    findings: { type: 'array', items: { type: 'string' } },
  },
} as const;

export async function captureArtifactManifest(
  pi: Pick<ExtensionAPI, 'exec'>,
): Promise<WorktreeContentManifest | undefined> {
  if (typeof pi.exec !== 'function') return undefined;
  return captureWorktreeContentManifest((command, args) => pi.exec(command, args));
}

export async function captureArtifactDigest(
  pi: Pick<ExtensionAPI, 'exec'>,
): Promise<string | undefined> {
  return (await captureArtifactManifest(pi))?.digest;
}

export { sha256Hex } from '@maestria/shared-pi/manifest-core';

export function installToolInterceptors(
  pi: ExtensionAPI,
  state: MaestriaState,
  modeController?: Pick<ModeController, 'getMode'>,
): void {
  pi.on('tool_call', async (event: ToolCallEvent, ctx: ExtensionContext) => {
    if (!event || !event.toolName) return;

    const mode = modeController?.getMode() ?? state.mode;
    const isRootSession =
      typeof pi.getActiveTools === 'function' && (pi.getActiveTools() ?? []).includes('task');
    const modeBlockReason = getModeToolBlockReason(
      mode,
      event.toolName,
      isRootSession,
      ['task', 'maestria_subagent'],
      ['task'],
      state.landingReview,
      event.input,
    );
    if (modeBlockReason) {
      return { block: true, reason: modeBlockReason };
    }

    if (
      isRootSession &&
      state.landingReview === 'approved' &&
      isLandingReviewShippingCommand(event.input)
    ) {
      const branchIsSafe = await isLandingReviewShippingCommandOnNonPrimaryBranch(
        event.input,
        async () => {
          if (typeof pi.exec !== 'function') return undefined;
          const result = await pi.exec('git', ['branch', '--show-current']);
          if (!result || result.code !== 0 || typeof result.stdout !== 'string') return undefined;
          return result.stdout;
        },
      );
      if (!branchIsSafe) {
        return {
          block: true,
          reason:
            'Landing review blocked: the current branch could not be verified as non-primary.',
        };
      }
      const currentArtifactManifest = await captureArtifactManifest(pi);
      if (!currentArtifactManifest) {
        Object.assign(
          state,
          markLandingReviewFailed(
            state,
            'OMP cannot validate the approved artifact through ExtensionAPI.exec.',
          ),
        );
        persistState(pi, state);
        return {
          block: true,
          reason: 'Landing review blocked: approved artifact validation is unavailable.',
        };
      }
      if (
        !sameWorktreeContentManifest(
          state.landingReviewBinding?.worktreeManifest,
          currentArtifactManifest,
        )
      ) {
        Object.assign(
          state,
          markLandingReviewStale(state, 'The approved artifact digest no longer matches.'),
        );
        persistState(pi, state);
        return { block: true, reason: 'Landing review blocked: the approved artifact is stale.' };
      }
      if (isLandingReviewShippingMutation(event.input)) {
        Object.assign(state, markLandingReviewShippingStarted(state));
        persistState(pi, state);
      }
    }

    if (
      (mode === 'blitz' || mode === null) &&
      isRootSession &&
      !state.reviewMode &&
      state.landingReview === 'execution' &&
      event.toolName === 'task' &&
      isLandingReviewDispatch(event.toolName, event.input, ['task'])
    ) {
      const artifactManifest = await captureArtifactManifest(pi);
      if (!artifactManifest) {
        Object.assign(
          state,
          markLandingReviewFailed(
            state,
            'OMP cannot obtain a trusted git artifact digest through the public ExtensionAPI.exec.',
          ),
        );
        persistState(pi, state);
        return {
          block: true,
          reason: 'Landing review blocked: a trusted artifact digest is unavailable in OMP.',
        };
      }
      Object.assign(state, armLandingReview(state, event.toolCallId, artifactManifest));
      Object.assign(state, beginLandingReview(state, event.toolCallId));
      event.input.outputSchema = LANDING_REVIEW_OUTPUT_SCHEMA;
      event.input.schemaMode = 'strict';
      const task = event.input.task;
      if (typeof task === 'string') {
        event.input.task = `${task}\n\n${LANDING_REVIEW_VERDICT_INSTRUCTIONS}\nArtifact digest: ${artifactManifest.digest}`;
      }
      persistState(pi, state);
    }

    // Block destructive tools in review mode
    if (state.reviewMode) {
      if (event.toolName === 'edit' || event.toolName === 'write' || event.toolName === 'bash') {
        return {
          block: true,
          reason: 'Review mode is active. Report findings, do not edit.',
        };
      }
    }

    // Block dangerous bash patterns regardless of mode
    if (event.toolName === 'bash') {
      if (!event.input || typeof event.input !== 'object') return undefined;
      const command = (event.input as Record<string, unknown>).command;
      if (typeof command === 'string') {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(command)) {
            if (ctx.hasUI) {
              const confirmed = await ctx.ui.confirm(
                'Dangerous Pattern Detected',
                `This command matches a dangerous pattern:\n${command}\nProceed?`,
              );
              if (confirmed) return undefined;
            }
            return {
              block: true,
              reason: `Command matches dangerous pattern: ${pattern}`,
            };
          }
        }
      }
    }

    return undefined; // allow
  });

  pi.on('tool_result', async (event) => {
    // OMP exposes the native task result through this public event. Async task
    // auto-delivery has no stable toolCallId/result pair here, so it remains
    // failed rather than being treated as approval.
    if (event.toolName !== 'task' || state.landingReview !== 'reviewing') return;
    const binding = state.landingReviewBinding;
    if (!binding || event.toolCallId !== binding.invocationId) return;

    if (event.isError) {
      Object.assign(
        state,
        markLandingReviewFailed(state, 'The trusted OMP reviewer task returned an error.'),
      );
      persistState(pi, state);
      return;
    }

    const details = event.details as TaskToolDetails | undefined;
    const result = details?.results?.length === 1 ? details.results[0] : undefined;
    const structured = result?.structuredOutput;
    if (
      !result ||
      result.agent !== 'reviewer' ||
      result.exitCode !== 0 ||
      !structured ||
      structured.status !== 'valid' ||
      structured.data === undefined
    ) {
      Object.assign(
        state,
        markLandingReviewFailed(
          state,
          'OMP exposes no trusted structured reviewer result for this task invocation. Async or invalid task results remain fail-closed.',
        ),
      );
      persistState(pi, state);
      return;
    }

    const artifactManifest = await captureArtifactManifest(pi);
    if (!artifactManifest) {
      Object.assign(
        state,
        markLandingReviewFailed(
          state,
          'OMP cannot revalidate the reviewed artifact through ExtensionAPI.exec.',
        ),
      );
    } else {
      try {
        const resultDigest = await sha256Hex([JSON.stringify(structured.data)]);
        Object.assign(
          state,
          recordLandingReviewVerdict(state, structured.data, artifactManifest, resultDigest),
        );
      } catch {
        Object.assign(
          state,
          markLandingReviewFailed(state, 'OMP cannot digest the trusted reviewer result.'),
        );
      }
    }
    persistState(pi, state);
  });
}
