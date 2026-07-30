import { Plugin } from '@opencode-ai/plugin';
import type { MaestriaPluginOptions } from '@/modes/types.js';
import { maestriaOptionsSchema } from '@/modes/types.js';
import { registerAgentTransforms } from '@/transforms/agents.js';
import { registerSessionHooks } from '@/hooks/session.js';

export default Plugin.define({
  id: 'maestria.v2',
  setup: async (ctx) => {
    // Parse plugin options with Zod
    const parseResult = maestriaOptionsSchema.safeParse((ctx as any).options ?? {});
    const options: MaestriaPluginOptions = parseResult.success ? parseResult.data : {};

    // 1. Register agents from generated agent files
    await registerAgentTransforms(ctx as any);

    // 2. Register session hooks for mode detection + rules injection
    await registerSessionHooks(ctx as any, options);

    console.log('[maestria-v2] Plugin initialized with ID: maestria.v2');
  },
});
