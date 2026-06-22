import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { renderMaestriaSummary, setReviewMode } from './state.js';

export function installCommands(pi: ExtensionAPI, state: MaestriaState): void {
  pi.registerCommand('orchestrate', {
    description: 'Start a full pipeline by delegating to the orchestrator',
    handler: async (args: string, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify('Usage: /orchestrate <goal> — describe what to accomplish');
        return;
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
      // Set review mode in state
      const updatedState = setReviewMode(state, true);
      Object.assign(state, updatedState);

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
