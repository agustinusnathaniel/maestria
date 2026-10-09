import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { AgentEditor, Transform } from '@/types.js';
import { isAgentMode, loadAgents } from '@/agents.js';

export const registerAgentTransforms = (ctx: {
  agent: { transform: Transform<AgentEditor> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerAgentTransformsEffect() {
    const agents = loadAgents();

    yield* ctx.agent.transform((registry: AgentEditor) => {
      for (const [name, config] of Object.entries(agents)) {
        const fallback = name === 'orchestrator' ? 'all' : 'subagent';
        try {
          registry.update(name, (draft) => {
            draft.description = config.description;
            draft.system = config.prompt;
            draft.mode = isAgentMode(config.mode) ? config.mode : fallback;
            draft.permissions = config.permissions;
            if (config.steps !== undefined) {
              draft.steps = config.steps;
            }
            if (config.color !== undefined && config.color !== '') {
              draft.color = config.color;
            }
          });
        } catch (error) {
          console.warn(`[maestria-v2] Failed to update agent "${name}":`, error);
        }
      }
    });
  });
