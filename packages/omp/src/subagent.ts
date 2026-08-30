import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { persistState, recordHandoff, recordSpecialistDelegated } from '@/state.js';
import { assertValidAgent, assertNonEmptyTask } from '@maestria/shared-pi/subagent-utils';

function recordAndPersist(
  pi: ExtensionAPI,
  state: MaestriaState,
  from: string,
  to: string,
  taskText: string,
): void {
  const updatedState = recordSpecialistDelegated(recordHandoff(state, from, to, taskText), to);
  Object.assign(state, updatedState);
  persistState(pi, state);
}

function validateOmpParams(params: {
  agent?: string;
  task?: string;
  tasks?: { agent: string; task: string }[];
  mode?: string;
}): void {
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    assertValidAgent(params.agent!);
    assertNonEmptyTask(params.task, 'Task description is required');
  } else {
    if (!params.tasks || params.tasks.length < 2) {
      throw new Error('For parallel/chain mode, tasks array is required with at least 2 items');
    }
    for (const t of params.tasks) {
      assertValidAgent(t.agent);
      assertNonEmptyTask(t.task, 'Task description is required for all tasks');
    }
  }
}

function handleSingleDispatch(
  pi: ExtensionAPI,
  state: MaestriaState,
  params: { agent: string; task: string },
) {
  recordAndPersist(pi, state, 'orchestrator', params.agent, params.task);
  return {
    content: [
      {
        text: `## Delegation: ${params.agent}\n\nUse the native \`task\` tool to dispatch:\n\`\`\`\ntask(agent: "${params.agent}", task: """${params.task}""")\n\`\`\``,
        type: 'text' as const,
      },
    ],
  };
}

function handleMultiDispatch(
  pi: ExtensionAPI,
  state: MaestriaState,
  params: { tasks: { agent: string; task: string }[]; mode: 'parallel' | 'chain' },
) {
  for (const t of params.tasks) {
    recordAndPersist(pi, state, 'orchestrator', t.agent, t.task);
  }
  const parts = [
    `## ${params.mode === 'parallel' ? 'Parallel' : 'Chain'} Dispatch Plan (${params.tasks.length} tasks)\n`,
  ];
  for (let i = 0; i < params.tasks.length; i += 1) {
    parts.push(
      `### ${i + 1}: ${params.tasks[i].agent}`,
      `\`task(agent: "${params.tasks[i].agent}", task: """${params.tasks[i].task}""")\``,
    );
    if (params.mode === 'chain' && i > 0) {
      parts.push('Previous result available via {previous} placeholder.');
    }
  }
  return { content: [{ text: parts.join('\n\n'), type: 'text' as const }] };
}

export function installSubagentTool(
  pi: ExtensionAPI,
  state: MaestriaState,
  _cleanups?: (() => void)[],
): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
  (pi.registerTool as any)({
    description:
      'Dispatch a task to a maestria specialist subagent (adventurer, architect, builder, diagnose, planner, reviewer, writer). Uses omp native task tool.',
    execute(
      _toolCallId: string,
      params: {
        agent?: string;
        task?: string;
        tasks?: { agent: string; task: string }[];
        mode?: 'parallel' | 'chain' | 'single';
      },
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: unknown,
    ) {
      if (state.reviewMode) {
        return {
          content: [
            {
              text: 'Subagent dispatch is not available during review mode. Use /restore-model to exit review mode first.',
              type: 'text' as const,
            },
          ],
        };
      }
      validateOmpParams(params);
      const mode = params.mode ?? 'single';
      if (mode === 'single') {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
        return handleSingleDispatch(pi, state, params as { agent: string; task: string });
      }
      return handleMultiDispatch(pi, state, {
        mode,
        tasks: params.tasks!,
      });
    },
    label: 'Maestria Subagent',
    name: 'maestria_subagent',
    parameters: pi.zod.object({
      agent: pi.zod
        .string()
        .describe(
          'Specialist agent name (required): adventurer, architect, builder, diagnose, planner, reviewer, writer',
        ),
      mode: pi.zod
        .enum(['parallel', 'chain', 'single'])
        .describe('Dispatch mode: single (default), parallel, or chain')
        .optional(),
      task: pi.zod.string().describe('Task description for the subagent (required)'),
      tasks: pi.zod
        .array(pi.zod.object({ agent: pi.zod.string(), task: pi.zod.string() }))
        .describe('Array of task objects for parallel or chain dispatch')
        .optional(),
    }),
  });

  // No subagent lifecycle event subscriptions needed - omp's built-in task tool
  // handles all dispatch lifecycle natively.
}
