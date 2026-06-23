import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import {
  cycleToReviewModel,
  persistState,
  renderMaestriaSummary,
  restoreOriginalState,
} from '@/state.js';
import { MAESTRIA_EVENTS } from '@/subagent.js';

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
        const prevOriginalModel = state.originalModel;
        await restoreOriginalState(pi, ctx, state);
        persistState(pi, state);
        pi.events?.emit(MAESTRIA_EVENTS.REVIEW_DEACTIVATED, {
          originalModel: prevOriginalModel,
          source: 'orchestrate',
          timestamp: Date.now(),
        });
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
        originalModel: currentModelId,
        originalTools: currentTools,
      };
      Object.assign(state, updatedState);
      persistState(pi, state);

      // 3. Switch to review model if configured
      if (state.reviewModel) {
        const switched = await cycleToReviewModel(pi, ctx, state);
        if (switched) {
          ctx.ui.notify(`Review mode: switched to ${switched}`);
          pi.events?.emit(MAESTRIA_EVENTS.REVIEW_ACTIVATED, {
            originalModel: state.originalModel,
            reviewModel: switched,
            timestamp: Date.now(),
          });
        }
      }

      // 4. Restrict to read-only tools
      pi.setActiveTools(READ_ONLY_TOOLS);

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
      const prevOriginalModel = state.originalModel;
      await restoreOriginalState(pi, ctx, state);
      persistState(pi, state);
      ctx.ui.notify('Restored original model and tools.');
      pi.events?.emit(MAESTRIA_EVENTS.REVIEW_DEACTIVATED, {
        originalModel: prevOriginalModel,
        timestamp: Date.now(),
      });
    },
  });

  pi.registerCommand('handoff', {
    description: 'Generate a structured handoff prompt for a new task context',
    handler: async (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /handoff <goal> — describe the task context for handoff');
        return;
      }

      // Build a structured handoff document with 6 fields
      const goal = args.trim();
      const handoffPrompt = [
        '**Goal:** ' + goal,
        '',
        '**Context:**',
        '- Mode: ' + (state.mode ?? 'none'),
        '- Active task: ' + (state.activeTask || 'none'),
        '- Specialists delegated: ' +
          ((state.specialistsDelegated?.length ?? 0) > 0
            ? state.specialistsDelegated.join(', ')
            : 'none'),
        '- Recent handoffs: ' + (state.handoffHistory?.length ?? 0) + ' entries',
        '- Files modified: ' +
          ((state.filesModified?.length ?? 0) > 0 ? state.filesModified.join(', ') : 'none'),
        '',
        '**Requirements:**',
        '(fill in specific requirements)',
        '',
        '**Known problems:**',
        (state.blockers?.length ?? 0) > 0
          ? state.blockers.map((b: string) => '- ' + b).join('\n')
          : '(no known problems documented)',
        '',
        '**Success criteria:**',
        '(fill in how to verify completion)',
        '',
        '**Next step:**',
        '(fill in what happens after this task)',
        '',
        '---',
        'Complete the fields above before sending.',
      ].join('\n');

      // Record in state
      state.handoffHistory = [
        { from: 'current', to: 'next', task: goal, timestamp: Date.now() },
        ...(state.handoffHistory ?? []),
      ].slice(0, 5);

      // Persist state
      persistState(pi, state);

      // Send as user message with steer delivery
      pi.sendUserMessage(handoffPrompt, { deliverAs: 'steer' });
    },
  });

  pi.registerCommand('review-model', {
    description: 'Set which model to use when entering review mode',
    handler: async (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /review-model <model-id>');
        return;
      }
      const modelId = args.trim();
      const models = ctx.modelRegistry.getAll();
      const model = models.find((m) => m.id === modelId);
      if (!model) {
        ctx.ui.notify(
          `Unknown model: "${modelId}". Available: ${models.map((m) => m.id).join(', ')}`,
        );
        return;
      }
      state.reviewModel = modelId;
      persistState(pi, state);
      ctx.ui.notify(`Review model set to: ${modelId}`);
    },
  });
}
