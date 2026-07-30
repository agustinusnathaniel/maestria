import type { PluginContext } from '@/types.js';
import { loadAgents, loadOrchestrator } from '@/agents.js';

interface AgentDraft {
  description?: string;
  mode?: string;
  prompt?: string;
  permission?: Record<string, unknown>;
  color?: string;
  maxSteps?: number;
}

interface AgentRegistry {
  list(): string[];
  get(name: string): AgentDraft | undefined;
  default(name: string): AgentDraft | undefined;
  update(name: string, updater: (draft: AgentDraft) => void): void;
  remove(name: string): void;
}

export async function registerAgentTransforms(ctx: PluginContext): Promise<void> {
  const agents = loadAgents();
  const orchestrator = loadOrchestrator();

  await ctx.agent.transform((registry: unknown) => {
    const reg = registry as AgentRegistry;

    // Register orchestrator first
    if (orchestrator) {
      try {
        reg.update('orchestrator', (draft) => {
          draft.description = orchestrator.description;
          draft.mode = orchestrator.mode || 'all';
          draft.prompt = orchestrator.prompt;
          draft.permission = orchestrator.permission;
          if (orchestrator.color) draft.color = orchestrator.color;
          if (orchestrator.maxSteps) draft.maxSteps = orchestrator.maxSteps;
        });
      } catch (err) {
        console.warn('[maestria-v2] Failed to update orchestrator agent:', err);
      }
    }

    // Register specialist agents
    for (const [name, config] of Object.entries(agents)) {
      try {
        reg.update(name, (draft) => {
          draft.description = config.description;
          draft.mode = config.mode || 'subagent';
          draft.prompt = config.prompt;
          draft.permission = config.permission;
          if (config.color) draft.color = config.color;
          if (config.maxSteps) draft.maxSteps = config.maxSteps;
        });
      } catch (err) {
        console.warn(`[maestria-v2] Failed to update agent "${name}":`, err);
      }
    }
  });
}
