import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { recordHandoff } from './state.js';

const ALLOWED_AGENTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;
type AllowedAgent = (typeof ALLOWED_AGENTS)[number];

// The 6-field handoff contract
const HANDOFF_FIELDS = [
  'Goal',
  'Context',
  'Requirements',
  'Known problems',
  'Success criteria',
  'Next step',
] as const;

export function validateHandoff(handoff: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const field of HANDOFF_FIELDS) {
    const regex = new RegExp(`\\*\\*${field}:\\*\\*[ \t]+\\S`, 'i');
    if (!regex.test(handoff)) {
      errors.push(`Missing or empty field: "${field}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function installSubagentTool(pi: ExtensionAPI, state: MaestriaState): void {
  pi.registerTool({
    name: 'subagent',
    label: 'Subagent',
    description: 'Dispatch a task to a specialist subagent',
    parameters: Type.Object({
      agent: Type.String({ description: 'Specialist agent name' }),
      task: Type.String({ description: 'Task description for the subagent' }),
      mode: Type.Optional(Type.String({ description: 'Optional workflow mode override' })),
    }),
    async execute(
      _toolCallId: string,
      params: { agent: string; task: string; mode?: string },
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ) {
      // Validate agent name
      if (!ALLOWED_AGENTS.includes(params.agent as AllowedAgent)) {
        throw new Error(`Unknown agent: "${params.agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
      }

      // Validate task description
      if (!params.task || !params.task.trim()) {
        throw new Error('Task description is required');
      }

      // Record handoff in state
      const updatedState = recordHandoff(state, 'orchestrator', params.agent, params.task);
      Object.assign(state, updatedState); // sync mutation-in-place

      // Attempt to dispatch via @gotgenes/pi-subagents; fallback gracefully
      try {
        const { getSubagentsService } = await import('@gotgenes/pi-subagents');
        const service = getSubagentsService() as any;
        if (!service) throw new Error('Subagents service unavailable');
        return {
          content: [
            {
              type: 'text' as const,
              text: await service.dispatch(params.agent, params.task, params.mode),
            },
          ],
        };
      } catch {
        // Return handoff payload as structured data when SDK unavailable
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Subagent SDK not available. Use the handoff data to delegate manually.',
            },
          ],
          details: { _handoff: { from: 'orchestrator', to: params.agent, task: params.task } },
        };
      }
    },
  } as any);
}
