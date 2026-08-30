/**
 * Shared slash-command installation for Maestria platform packages.
 *
 * Pure TypeScript - no platform-specific dependencies.
 * Consumed by both @maestria/omp and @maestria/pi to eliminate duplication
 * of the maestria-status/review/restore-model/handoff/review-model commands.
 *
 * @module
 */

import type { MaestriaState } from './state-core.js';
import { persistState, recordHandoff, renderMaestriaSummary } from './state-core.js';
import { cycleToReviewModel, restoreOriginalState } from './review-core.js';
import { MAESTRIA_EVENTS } from './subagent-utils.js';

// ── Duck-typed platform interfaces ──

interface CommandsCtx {
  ui: {
    notify(msg: string): void;
    setEditorText(text: string): void;
  };
  model?: { id: string };
  modelRegistry: { getAll(): { id: string }[] };
}

interface CommandsPi {
  registerCommand(
    name: string,
    opts: {
      description: string;
      handler: (args: string, ctx: CommandsCtx) => Promise<void> | void;
    },
  ): void;
  getActiveTools(): string[];
  setActiveTools(tools: string[]): void | Promise<void>;
  setModel(model: unknown): void | Promise<void>;
  sendUserMessage(text: string, opts: { deliverAs: string }): void;
  appendEntry(type: string, data: unknown): void;
  events?: { emit(event: string, data: unknown): void };
}

/**
 * Read-only tools that let a reviewer inspect code without making changes.
 *
 * - `read`, `grep`, `find`, `ls`, `glob` - all non-destructive.
 * - Excluded: `bash`, `edit`, `write` - these can modify the filesystem.
 *
 * `glob` is included for file pattern matching even though it's not a
 * built-in Pi tool - extensions may register it, and including it is a no-op
 * if absent.
 */
const READ_ONLY_TOOLS = ['read', 'grep', 'find', 'ls', 'glob'];

function registerMaestriaStatus(pi: CommandsPi, state: MaestriaState): void {
  pi.registerCommand('maestria-status', {
    description: 'Show current maestria session state including handoff history',
    handler: (_args: string, ctx) => {
      const summary = renderMaestriaSummary(state);
      if (!summary) {
        ctx.ui.notify('No active maestria state to report.');
        return;
      }
      ctx.ui.setEditorText(summary);
    },
  });
}

function registerReviewCommand(pi: CommandsPi, state: MaestriaState): void {
  pi.registerCommand('review', {
    description: 'Enter review mode. Blocks destructive tools, sets read-only toolset.',
    handler: async (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /review <target> - describe what to review');
        return;
      }
      const currentModelId = ctx.model?.id ?? null;
      const currentTools = pi.getActiveTools();
      Object.assign(state, {
        ...state,
        originalModel: currentModelId,
        originalTools: currentTools,
        reviewMode: true,
      } as MaestriaState);
      persistState(pi, state);
      if (
        state.reviewModel !== null &&
        state.reviewModel !== undefined &&
        state.reviewModel !== ''
      ) {
        const switched = await cycleToReviewModel(pi, ctx, state);
        if (switched !== null && switched !== undefined && switched !== '') {
          ctx.ui.notify(`Review mode: switched to ${switched}`);
          pi.events?.emit(MAESTRIA_EVENTS.REVIEW_ACTIVATED, {
            originalModel: state.originalModel,
            reviewModel: switched,
            timestamp: Date.now(),
          });
        }
      }
      void pi.setActiveTools(READ_ONLY_TOOLS);
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
}

function registerRestoreModel(pi: CommandsPi, state: MaestriaState): void {
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
}

function registerHandoffCommand(pi: CommandsPi, state: MaestriaState): void {
  pi.registerCommand('handoff', {
    description: 'Generate a structured handoff prompt for a new task context',
    handler: (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /handoff <goal> - describe the task context for handoff');
        return;
      }
      const goal = args.trim();
      const handoffPrompt = [
        `**Goal:** ${goal}`,
        '',
        '**Context:**',
        `- Mode: ${state.mode ?? 'none'}`,
        `- Active task: ${state.activeTask || 'none'}`,
        `- Specialists delegated: ${
          (state.specialistsDelegated?.length ?? 0) > 0
            ? state.specialistsDelegated.join(', ')
            : 'none'
        }`,
        `- Recent handoffs: ${state.handoffHistory?.length ?? 0} entries`,
        `- Files modified: ${
          (state.filesModified?.length ?? 0) > 0 ? state.filesModified.join(', ') : 'none'
        }`,
        '',
        '**Requirements:**',
        '(fill in specific requirements)',
        '',
        '**Known problems:**',
        (state.blockers?.length ?? 0) > 0
          ? state.blockers.map((b: string) => `- ${b}`).join('\n')
          : '(no known problems documented)',
        '',
        '**Assumptions documented:**',
        '(document assumptions made, tagged [inferred] where uncertain)',
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
      Object.assign(state, recordHandoff(state, 'current', 'next', goal));
      persistState(pi, state);
      pi.sendUserMessage(handoffPrompt, { deliverAs: 'steer' });
    },
  });
}

function registerReviewModel(pi: CommandsPi, state: MaestriaState): void {
  pi.registerCommand('review-model', {
    description: 'Set which model to use when entering review mode',
    handler: (args: string, ctx) => {
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

export function installCommands(pi: CommandsPi, state: MaestriaState): void {
  registerMaestriaStatus(pi, state);
  registerReviewCommand(pi, state);
  registerRestoreModel(pi, state);
  registerHandoffCommand(pi, state);
  registerReviewModel(pi, state);
}
