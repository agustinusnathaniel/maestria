import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { AgentDraft, Transform } from '@/types.js';
import type { AgentInfo } from '@/agents.js';
import { isAgentMode, loadAgents, loadOrchestrator } from '@/agents.js';

export const registerAgentTransforms = (ctx: {
  agent: { transform: Transform<AgentDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerAgentTransformsEffect() {
    const agents = loadAgents();
    const orchestrator = loadOrchestrator();

    // Orchestrator first (it is the router other agents delegate to), then
    // specialists. The orchestrator defaults to mode 'all', specialists to
    // 'subagent'. registry.update() is an upsert, so missing agents are created.
    const updates: { config: AgentInfo; fallback: 'all' | 'subagent'; name: string }[] =
      Object.entries(agents).map(([name, config]) => ({
        config,
        fallback: 'subagent' as const,
        name,
      }));
    if (orchestrator) {
      updates.unshift({ config: orchestrator, fallback: 'all', name: orchestrator.name });
    }

    yield* ctx.agent.transform((registry: AgentDraft) => {
      for (const { name, config, fallback } of updates) {
        try {
          registry.update(name, (draft) => {
            draft.description = config.description;
            draft.system = config.prompt;
            draft.mode = isAgentMode(config.mode) ? config.mode : fallback;
            draft.steps = config.steps;
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
