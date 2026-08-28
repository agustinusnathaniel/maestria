import { Effect } from 'effect';
import { Plugin } from '@opencode-ai/plugin/effect';
import type { PluginContext } from '@/types.js';
import type { MaestriaPluginOptions } from '@/modes/types.js';
import { maestriaOptionsSchema } from '@/modes/types.js';
import { registerAgentTransforms } from '@/transforms/agents.js';
import { registerReferenceTransforms } from '@/transforms/references.js';
import { registerToolTransforms } from '@/transforms/tools.js';
import { registerSessionHooks } from '@/hooks/session.js';

export default Plugin.define({
  id: 'maestria.v2',
  effect: (ctx: PluginContext) =>
    Effect.gen(function* () {
      const parseResult = maestriaOptionsSchema.safeParse(ctx.options ?? {});
      const options: MaestriaPluginOptions = parseResult.success ? parseResult.data : {};
      yield* registerAgentTransforms(ctx);
      yield* registerReferenceTransforms(ctx);
      yield* registerSessionHooks(ctx, options);
      yield* registerToolTransforms(ctx);
      yield* Effect.sync(() =>
        console.log('[maestria-v2] Plugin initialized with ID: maestria.v2'),
      );
    }),
});
