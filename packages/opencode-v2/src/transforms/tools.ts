import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { PluginContext } from '@/types.js';

export const registerToolTransforms = (
  ctx: PluginContext,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerToolTransformsEffect() {
    yield* ctx.tool.transform((tools) => {
      tools.add({
        description:
          'Report the loaded maestria.v2 plugin status: agents registered and mode keywords enabled.',
        execute: () =>
          Effect.succeed({
            content: 'maestria.v2 plugin active: 8 agents, 3 mode keywords (fein, sonar, blitz).',
            output: {
              agents: 8,
              modes: ['fein', 'sonar', 'blitz'],
              plugin: 'maestria.v2',
            },
          }),
        input: {
          additionalProperties: false,
          properties: {},
          type: 'object',
        } as const,
        name: 'maestria_status',
      });
    });
  });
