import { Effect } from 'effect';
import type { PluginContext } from '@/types.js';

export function registerToolTransforms(
  ctx: PluginContext,
): Effect.Effect<void, never, import('effect').Scope.Scope> {
  return Effect.gen(function* () {
    yield* ctx.tool.transform((tools) => {
      tools.add({
        name: 'maestria_status',
        description:
          'Report the loaded maestria.v2 plugin status: agents registered and mode keywords enabled.',
        input: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        } as const,
        execute: () =>
          Effect.succeed({
            output: {
              plugin: 'maestria.v2',
              agents: 8,
              modes: ['fein', 'sonar', 'blitz'],
            },
            content: 'maestria.v2 plugin active: 8 agents, 3 mode keywords (fein, sonar, blitz).',
          }),
      });
    });
  });
}
