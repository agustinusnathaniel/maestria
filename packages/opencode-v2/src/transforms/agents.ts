import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { AgentDraft, Transform } from '@/types.js';
import type { AgentInfo } from '@/agents.js';
import { isAgentMode, loadAgents, loadOrchestrator } from '@/agents.js';

export const registerAgentTransforms = (ctx: {
  agent: { transform: Transform<AgentDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerAgentTransformsEffect() {
    const orchestrator = loadOrchestrator();

    // Orchestrator first (it is the router other agents delegate to), then
    // specialists. registry.update() is an upsert, so missing agents are created.
    // Mode defaults inline: orchestrator routes everywhere ('all'), specialists
    // stay scoped to subagent work unless their frontmatter says otherwise.
    const agents: Record<string, AgentInfo> = {
      ...(orchestrator ? { [orchestrator.name]: orchestrator } : {}),
      ...loadAgents(),
    };

    yield* ctx.agent.transform((registry: AgentDraft) => {
      for (const [name, config] of Object.entries(agents)) {
        const fallback = name === 'orchestrator' ? 'all' : 'subagent';
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
