import {
  isToolCallEventType,
  type ExtensionAPI,
  type ToolCallEvent,
  type ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { DANGEROUS_PATTERNS } from '@maestria/shared-pi/tools-core';
import { persistState, recordFileModified, recordFileRead } from '@/state.js';

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  pi.on('tool_call', async (event: ToolCallEvent, ctx: ExtensionContext) => {
    if (!event || !event.toolName) return;

    // ── Pure dispatcher enforcement ──
    // When a maestria workflow mode is active, restrict the root session
    // (orchestrator) to ONLY the maestria_subagent delegation tool.
    // Subagent sessions are detected by the absence of the pi-subagents
    // 'subagent' tool (stripped by applyRecursionGuard in child sessions).
    if (state.mode !== null && pi.getActiveTools().includes('subagent')) {
      if (event.toolName !== 'maestria_subagent') {
        return {
          block: true,
          reason:
            `Tool '${event.toolName}' is blocked for the orchestrator. ` +
            `Use 'maestria_subagent' to delegate tasks to specialists.`,
        };
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

    // Record file access for session state (ADR-PI-002: tool_call maintains file tracking).
    // Only record when the call is allowed to proceed.
    let tracked = false;
    if (isToolCallEventType('read', event)) {
      const path = event.input?.path;
      if (typeof path === 'string' && path) {
        Object.assign(state, recordFileRead(state, path));
        tracked = true;
      }
    } else if (isToolCallEventType('edit', event) || isToolCallEventType('write', event)) {
      const path = event.input?.path;
      if (typeof path === 'string' && path) {
        Object.assign(state, recordFileModified(state, path));
        tracked = true;
      }
    }
    if (tracked) {
      persistState(pi, state);
    }

    return undefined; // allow
  });
}
