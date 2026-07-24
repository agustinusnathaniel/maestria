import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState, recordHandoff } from '@/state.js';
import { MAESTRIA_EVENTS } from '@/events.js';

const ALLOWED_AGENTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

export function installSubagentTool(
  pi: ExtensionAPI,
  state: MaestriaState,
  _cleanups?: Array<() => void>,
): void {
  (pi.registerTool as any)({
    name: 'maestria_subagent',
    label: 'Maestria Subagent',
    description:
      'Dispatch a task to a maestria specialist subagent (adventurer, architect, builder, diagnose, planner, reviewer, writer). Uses omp native task tool.',
    parameters: pi.zod.object({
      agent: pi.zod
        .string()
        .describe(
          'Specialist agent name (adventurer, architect, builder, diagnose, planner, reviewer, writer)',
        )
        .optional(),
      task: pi.zod.string().describe('Task description for the subagent').optional(),
      tasks: pi.zod
        .array(
          pi.zod.object({
            agent: pi.zod.string(),
            task: pi.zod.string(),
          }),
        )
        .describe('Array of task objects for parallel or chain dispatch')
        .optional(),
      mode: pi.zod
        .enum(['parallel', 'chain', 'single'])
        .describe('Dispatch mode: single (default), parallel, or chain')
        .optional(),
    }),
    async execute(
      _toolCallId: string,
      params: {
        agent?: string;
        task?: string;
        tasks?: Array<{ agent: string; task: string }>;
        mode?: 'parallel' | 'chain' | 'single';
      },
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: unknown,
    ) {
      // Block subagent dispatch when in review mode
      if (state.reviewMode) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Subagent dispatch is not available during review mode. Use /restore-model to exit review mode first.',
            },
          ],
        };
      }

      const mode = params.mode ?? 'single';

      // Validate parameters
      if (mode === 'single') {
        if (
          !params.agent ||
          !ALLOWED_AGENTS.includes(params.agent as (typeof ALLOWED_AGENTS)[number])
        ) {
          throw new Error(
            `Unknown agent: "${params.agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`,
          );
        }
        if (!params.task || !params.task.trim()) {
          throw new Error('Task description is required');
        }
      } else {
        if (!params.tasks || params.tasks.length < 2) {
          throw new Error('For parallel/chain mode, tasks array is required with at least 2 items');
        }
        for (const t of params.tasks) {
          if (!ALLOWED_AGENTS.includes(t.agent as (typeof ALLOWED_AGENTS)[number])) {
            throw new Error(`Unknown agent: "${t.agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
          }
          if (!t.task || !t.task.trim()) {
            throw new Error('Task description is required for all tasks');
          }
        }
      }

      // Build structured handoff for omp's built-in task tool.
      // omp's task tool discovers our agents from ~/.omp/agent/agents/*.md,
      // so we construct the delegation prompt that the LLM will process.
      if (mode === 'single') {
        const { agent, task } = params as { agent: string; task: string };
        const updatedState = recordHandoff(state, 'orchestrator', agent, task);
        Object.assign(state, updatedState);
        persistState(pi, state);

        return {
          content: [
            {
              type: 'text' as const,
              text: `## Delegation: ${agent}\n\nUse the native \`task\` tool to dispatch:\n\`\`\`\ntask(agent: "${agent}", task: """${task}""")\n\`\`\``,
            },
          ],
        };
      }

      // For parallel/chain modes, generate a structured plan
      const taskList = params.tasks!;
      for (const t of taskList) {
        const updatedState = recordHandoff(state, 'orchestrator', t.agent, t.task);
        Object.assign(state, updatedState);
      }
      persistState(pi, state);

      const parts = [
        `## ${mode === 'parallel' ? 'Parallel' : 'Chain'} Dispatch Plan (${taskList.length} tasks)\n`,
      ];
      for (let i = 0; i < taskList.length; i++) {
        parts.push(`### ${i + 1}: ${taskList[i].agent}`);
        if (mode === 'chain' && i > 0) {
          parts.push(`\`task(agent: "${taskList[i].agent}", task: """${taskList[i].task}""")\``);
          parts.push('Previous result available via {previous} placeholder.');
        } else {
          parts.push(`\`task(agent: "${taskList[i].agent}", task: """${taskList[i].task}""")\``);
        }
      }

      return {
        content: [{ type: 'text' as const, text: parts.join('\n\n') }],
      };
    },
  });

  // No subagent lifecycle event subscriptions needed — omp's built-in task tool
  // handles all dispatch lifecycle natively.
}
