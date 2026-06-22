import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { renderMaestriaSummary, restoreOriginalState } from './state.js';

/**
 * Read-only tools that let a reviewer inspect code without making changes.
 *
 * - `read`, `grep`, `find`, `ls`, `glob` — all non-destructive.
 * - Excluded: `bash`, `edit`, `write` — these can modify the filesystem.
 *
 * `glob` is included for file pattern matching even though it's not a
 * built-in Pi tool — extensions may register it, and including it is a no-op
 * if absent.
 */
const READ_ONLY_TOOLS = ['read', 'grep', 'find', 'ls', 'glob'];

export function installCommands(pi: ExtensionAPI, state: MaestriaState): void {
  pi.registerCommand('orchestrate', {
    description: 'Start a full pipeline by delegating to the orchestrator',
    handler: async (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /orchestrate <goal> — describe what to accomplish');
        return;
      }

      // Exit review mode if active (restore original model/tools)
      if (state.reviewMode) {
        await restoreOriginalState(pi, ctx, state);
      }

      pi.sendUserMessage(
        [
          `[ORCHESTRATE: ${args}]`,
          '',
          `Orchestrate the full maestria pipeline to: ${args}`,
          'Use the orchestrator prompt template for subagent delegation.',
        ].join('\n'),
        { deliverAs: 'steer' },
      );
    },
  });

  pi.registerCommand('maestria-status', {
    description: 'Show current maestria session state including handoff history',
    handler: async (_args: string, ctx) => {
      const summary = renderMaestriaSummary(state);
      if (!summary) {
        ctx.ui.notify('No active maestria state to report.');
        return;
      }
      ctx.ui.setEditorText(summary);
    },
  });

  pi.registerCommand('review', {
    description: 'Enter review mode. Blocks destructive tools, sets read-only toolset.',
    handler: async (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /review <target> — describe what to review');
        return;
      }

      // 1. Save current model and tools for later restoration
      const currentModelId = ctx.model?.id ?? null;
      const currentTools = pi.getActiveTools();

      // 2. Update state: mark review mode, store originals
      const updatedState: MaestriaState = {
        ...state,
        reviewMode: true,
        reviewModel: currentModelId,
        originalModel: currentModelId,
        originalTools: currentTools,
      };
      Object.assign(state, updatedState);
      pi.appendEntry('maestria_state', state);

      // 3. Restrict to read-only tools
      pi.setActiveTools(READ_ONLY_TOOLS);

      // 4. Try to switch to a review-optimized model if configured
      if (state.reviewModel && currentModelId !== state.reviewModel) {
        try {
          const models = ctx.modelRegistry.getAll();
          const reviewModel = models.find((m) => m.id === state.reviewModel);
          if (reviewModel) {
            await pi.setModel(reviewModel);
          }
        } catch {
          ctx.ui.notify(
            `Warning: could not switch to review model "${state.reviewModel}". Tool restriction is active.`,
          );
        }
      }

      pi.sendUserMessage(
        [
          `[REVIEW: ${args}]`,
          '',
          `Review: ${args}. Use the reviewer prompt template.`,
          'Read only, no edits, report findings.',
        ].join('\n'),
        { deliverAs: 'steer' },
      );
    },
  });

  pi.registerCommand('restore-model', {
    description:
      'Restore the original model and tools that were active before review mode was entered.',
    handler: async (_args: string, ctx) => {
      if (!state.reviewMode) {
        ctx.ui.notify('Not in review mode. Nothing to restore.');
        return;
      }
      await restoreOriginalState(pi, ctx, state);
      ctx.ui.notify('Restored original model and tools.');
    },
  });
}
