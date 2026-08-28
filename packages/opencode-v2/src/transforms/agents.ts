import { Effect } from 'effect';
import type { AgentDraft, Transform } from '@/types.js';
import { loadAgents, loadOrchestrator } from '@/agents.js';

export function registerAgentTransforms(ctx: {
  agent: { transform: Transform<AgentDraft> };
}): Effect.Effect<void, never, import('effect').Scope.Scope> {
  return Effect.gen(function* () {
    const agents = loadAgents();
    const orchestrator = loadOrchestrator();

    yield* ctx.agent.transform((registry: AgentDraft) => {
      if (orchestrator) {
        try {
          registry.update(orchestrator.name, (draft) => {
            draft.description = orchestrator.description;
            draft.system = orchestrator.prompt;
            draft.mode = (orchestrator.mode as 'all' | 'subagent' | 'primary') || 'all';
            draft.steps = orchestrator.steps;
            if (orchestrator.color) draft.color = orchestrator.color;
          });
        } catch (err) {
          console.warn('[maestria-v2] Failed to update orchestrator agent:', err);
        }
      }

      for (const [name, config] of Object.entries(agents)) {
        try {
          registry.update(name, (draft) => {
            draft.description = config.description;
            draft.system = config.prompt;
            draft.mode = (config.mode as 'all' | 'subagent' | 'primary') || 'subagent';
            draft.steps = config.steps;
            if (config.color) draft.color = config.color;
          });
        } catch (err) {
          console.warn(`[maestria-v2] Failed to update agent "${name}":`, err);
        }
      }
    });
  });
}
