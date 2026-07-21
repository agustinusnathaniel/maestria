import type { ExtensionAPI, ToolCallEvent, ExtensionContext } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';

// Note: omp's @oh-my-pi/pi-coding-agent does not export isToolCallEventType,
// so we use direct event.toolName string comparison instead.

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /mkfs\.\w+/,
  /:(){ :\|:& };:/,
  />\s*\/etc\/(passwd|shadow|sudoers)/,
  /\beval\b/,
  /wget\s+-O\s*-\s*\|\s*(bash|sh)/,
  /curl\s+.*\|\s*(bash|sh)/,
  /crontab\s+-r/,
];

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  pi.on('tool_call', async (event: ToolCallEvent, ctx: ExtensionContext) => {
    if (!event || !event.toolName) return;

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
}
