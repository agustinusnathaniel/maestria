import {
  isToolCallEventType,
  type ExtensionAPI,
  type ToolCallEvent,
  type ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import {
  DANGEROUS_PATTERNS,
  getModeToolBlockReason,
  isLandingReviewShippingCommand,
  isLandingReviewShippingCommandOnNonPrimaryBranch,
  isLandingReviewShippingMutation,
} from '@maestria/shared-pi/tools-core';
import {
  captureWorktreeContentManifest,
  sameWorktreeContentManifest,
  type WorktreeContentManifest,
} from '@maestria/shared-pi/manifest-core';
import type { ModeController } from '@maestria/shared-pi/modes-core';
import {
  markLandingReviewFailed,
  markLandingReviewShippingStarted,
  markLandingReviewStale,
  persistState,
} from '@/state.js';

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
      typeof pi.getActiveTools === 'function' && (pi.getActiveTools() ?? []).includes('subagent');
    const modeBlockReason = getModeToolBlockReason(
      mode,
      event.toolName,
      isRootSession,
      ['maestria_subagent', 'subagent'],
      ['maestria_subagent'],
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
            'Pi cannot validate the approved artifact through ExtensionAPI.exec.',
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

    // Block destructive tools in review mode
    if (state.reviewMode) {
      if (
        isToolCallEventType('edit', event) ||
        isToolCallEventType('write', event) ||
        isToolCallEventType('bash', event)
      ) {
        return {
          block: true,
          reason: 'Review mode is active. Report findings, do not edit.',
        };
      }
    }

    // Block dangerous bash patterns regardless of mode
    if (isToolCallEventType('bash', event)) {
      if (!event.input || typeof event.input !== 'object') return undefined;
      const command = event.input.command;
      if (command) {
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
}
