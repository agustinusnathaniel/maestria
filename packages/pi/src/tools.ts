import type {
  ExtensionAPI,
  ToolCallEvent,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /dd\s+if=/,
  />\s*\/dev\/sd/,
  /chmod\s+-R\s+777\s+\//,
  /mkfs\.\w+/,
  /:(){ :\|:& };:/, // fork bomb
];

const DESTRUCTIVE_TOOLS = new Set(['edit', 'write', 'bash']);

export function installToolInterceptors(pi: ExtensionAPI, state: MaestriaState): void {
  pi.on('tool_call', async (event: ToolCallEvent, ctx: ExtensionContext) => {
    if (!event || !event.toolName) return;

    // Block destructive tools in review mode
    if (state.reviewMode && DESTRUCTIVE_TOOLS.has(event.toolName)) {
      return {
        block: true,
        reason: 'Review mode is active. Report findings, do not edit.',
      };
    }

    // Block dangerous bash patterns regardless of mode
    if (event.toolName === 'bash') {
      const bashInput = event.input as { command?: string };
      const command = bashInput.command;
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
