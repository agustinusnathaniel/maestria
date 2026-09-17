import { Effect } from 'effect';
import { Plugin } from '@opencode-ai/plugin/effect';
import type { PluginContext } from '@/types.js';
import type { MaestriaPluginOptions } from '@/modes/types.js';
import { maestriaOptionsSchema } from '@/modes/types.js';
import { registerAgentTransforms } from '@/transforms/agents.js';
import { registerReferenceTransforms } from '@/transforms/references.js';
import { registerCommandTransforms } from '@/transforms/commands.js';
import { registerSkillTransforms } from '@/transforms/skills.js';
import { registerToolTransforms } from '@/transforms/tools.js';
import { registerSessionHooks } from '@/hooks/session.js';

/**
 * maestria.v2 entrypoint (Effect plugin API).
 *
 * Packaging decision: this POC stays a separate `@maestria/opencode-v2` package
 * coexisting with the stable V1 `maestria` plugin. Live docs (/migrate-v1) allow
 * converging both in one default export (Plugin.define spread plus legacy
 * server(), supported since OpenCode 1.18.29); convergence is deferred until
 * V2 leaves beta. See README Known limitations.
 */
export default Plugin.define({
  effect: (ctx: PluginContext) =>
    Effect.gen(function* initMaestriaV2() {
      const parseResult = maestriaOptionsSchema.safeParse(ctx.options ?? {});
      const options: MaestriaPluginOptions = parseResult.success ? parseResult.data : {};
      yield* registerAgentTransforms(ctx);
      yield* registerReferenceTransforms(ctx);
      yield* registerSessionHooks(ctx, options);
      yield* registerCommandTransforms(ctx);
      yield* registerSkillTransforms(ctx);
      yield* registerToolTransforms(ctx);
      yield* Effect.sync(() => {
        console.log('[maestria-v2] Plugin initialized with ID: maestria.v2');
      });
    }),
  id: 'maestria.v2',
});
