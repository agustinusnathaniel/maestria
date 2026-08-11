import type { ExtensionAPI, ToolCallEvent, ExtensionContext } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { DANGEROUS_PATTERNS } from '@maestria/shared-pi/tools-core';
import { recordFileModified, recordFileRead } from '@/state.js';

// Note: omp's @oh-my-pi/pi-coding-agent does not export isToolCallEventType,
// so we use direct event.toolName string comparison instead.

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  pi.on('tool_call', async (event: ToolCallEvent, ctx: ExtensionContext) => {
    if (!event || !event.toolName) return;

    // ── Pure dispatcher enforcement ──
    // When a maestria workflow mode is active, restrict sessions that
    // can delegate (root orchestrator) to only task/maestria_subagent.
    // Detection: built-in 'task' tool is present in root and any agent
    // with spawns capability; our specialist agents don't set spawns
    // so they won't have 'task' auto-added.
    if (state.mode !== null && pi.getActiveTools().includes('task')) {
      // The public OMP extension API exposes tool names but not the provenance
      // of a tool call. Do not allow a name-only `goal` exemption: an
      // extension can register a colliding tool name. User-issued `/goal`
      // slash commands remain OMP-owned and do not pass through this model
      // tool-call enforcement hook.
      if (event.toolName !== 'task' && event.toolName !== 'maestria_subagent') {
        return {
          block: true,
          reason:
            `Tool '${event.toolName}' is blocked for the orchestrator. ` +
            `Use 'maestria_subagent' or 'task()' to delegate to specialists.`,
        };
      }
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

    // Record file access for session state (ADR-PI-002: tool_call maintains file tracking).
    let tracked = false;
    if (event.toolName === 'read') {
      const path = (event.input as Record<string, unknown> | undefined)?.path;
      if (typeof path === 'string' && path) {
        Object.assign(state, recordFileRead(state, path));
        tracked = true;
      }
    } else if (event.toolName === 'edit' || event.toolName === 'write') {
      const path = (event.input as Record<string, unknown> | undefined)?.path;
      if (typeof path === 'string' && path) {
        Object.assign(state, recordFileModified(state, path));
        tracked = true;
      }
    }
    if (tracked) {
      pi.appendEntry('maestria_state', { ...state });
    }

    return undefined; // allow
  });
}
