import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { AgentDraft, Transform } from '@/types.js';
import { isAgentMode, loadAgents, loadOrchestrator } from '@/agents.js';

export const registerAgentTransforms = (ctx: {
  agent: { transform: Transform<AgentDraft> };
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* registerAgentTransformsEffect() {
    const agents = loadAgents();
    const orchestrator = loadOrchestrator();

    yield* ctx.agent.transform((registry: AgentDraft) => {
      if (orchestrator) {
        try {
          registry.update(orchestrator.name, (draft) => {
            draft.description = orchestrator.description;
            draft.system = orchestrator.prompt;
            draft.mode = isAgentMode(orchestrator.mode) ? orchestrator.mode : 'all';
            draft.steps = orchestrator.steps;
            if (orchestrator.color !== undefined && orchestrator.color !== '') {
              draft.color = orchestrator.color;
            }
          });
        } catch (error) {
          console.warn('[maestria-v2] Failed to update orchestrator agent:', error);
        }
      }

      for (const [name, config] of Object.entries(agents)) {
        try {
          registry.update(name, (draft) => {
            draft.description = config.description;
            draft.system = config.prompt;
            draft.mode = isAgentMode(config.mode) ? config.mode : 'subagent';
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
