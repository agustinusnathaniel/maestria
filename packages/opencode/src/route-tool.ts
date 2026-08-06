import { tool, type ToolDefinition, type ToolContext } from '@opencode-ai/plugin';
import { MAESTRIA_ROUTE_TOOL } from '@/route-gate.js';
import { RouteRegistry } from '@/route-registry.js';

export function createMaestriaRouteTool(registry: RouteRegistry): ToolDefinition {
  return tool({
    description:
      'Select the root orchestrator route for this user turn. ' +
      'Use direct for implementation without child sessions, focused for research/design, ' +
      'full for the complete dispatcher pipeline, or landing-review exactly once after direct work ' +
      'to arm maestria_landing_review.',
    args: {
      // Use the plugin's zod instance. The package's public schema is on a
      // newer zod minor and cannot be passed across the plugin type boundary.
      route: tool.schema.enum(['direct', 'focused', 'full', 'landing-review']),
    },
    execute: async ({ route }, context: ToolContext) => {
      if (context.agent !== 'orchestrator' || !registry.isRootSession(context.sessionID)) {
        return {
          title: MAESTRIA_ROUTE_TOOL,
          output: 'Route selection is only available to the root Maestria orchestrator.',
        };
      }

      registry.select(context.sessionID, route);
      return {
        title: `Route selected: ${route}`,
        output: `The ${route} route is active for this user turn.`,
      };
    },
  });
}
