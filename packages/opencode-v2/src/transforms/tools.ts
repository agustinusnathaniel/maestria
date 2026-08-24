import type { PluginContext } from '@/types.js';

/**
 * Demo tool registration using the real V2 tool API.
 *
 * NOTE: The public docs (opencode.ai/v2/docs/build/plugins) show a two-arg
 * form `tools.add("name", {...})`. The installed package
 * (@opencode-ai/plugin@0.0.0-next-17444) uses a one-arg form:
 * `tools.add({ name, description, input, output, execute })` where `name`
 * is a required field INSIDE the tool object. This file follows the
 * installed package (ground truth).
 *
 * `input`/`output` accept JsonSchema.JsonSchema values (effect schema),
 * so plain JSON Schema objects type-check.
 */
export async function registerToolTransforms(ctx: PluginContext): Promise<void> {
  await ctx.tool.transform((tools) => {
    tools.add({
      name: 'maestria_status',
      description:
        'Report the loaded maestria.v2 plugin status: agents registered and mode keywords enabled.',
      input: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as const,
      execute: async () => ({
        output: {
          plugin: 'maestria.v2',
          agents: 8,
          modes: ['fein', 'sonar', 'blitz'],
        },
        content: 'maestria.v2 plugin active: 8 agents, 3 mode keywords (fein, sonar, blitz).',
      }),
    });
  });
}
