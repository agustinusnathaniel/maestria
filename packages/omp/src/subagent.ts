import { assertNonEmptyTask, assertValidAgent } from '@maestria/shared-pi/subagent-utils';
import type { ExtensionAPI } from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';
import { persistState, recordHandoff, recordSpecialistDelegated } from '@/state.js';

const validateAgent: typeof assertValidAgent = assertValidAgent;
const validateTask: typeof assertNonEmptyTask = assertNonEmptyTask;

interface SubagentSchema {
  describe: (description: string) => SubagentSchema;
  optional: () => SubagentSchema;
}

interface SubagentZod {
  array: (schema: SubagentSchema) => SubagentSchema;
  enum: (values: readonly string[]) => SubagentSchema;
  object: (shape: Record<string, SubagentSchema>) => SubagentSchema;
  string: () => SubagentSchema;
}

export interface SubagentToolParams {
  agent?: string;
  mode?: 'parallel' | 'chain' | 'single';
  task?: string;
  tasks?: { agent: string; task: string }[];
}

export interface SubagentToolResult {
  content: [{ text: string; type: 'text' }];
}

export interface SubagentToolDefinition {
  description: string;
  execute: (
    toolCallId: string,
    params: SubagentToolParams,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<SubagentToolResult>;
  label: string;
  name: string;
  parameters: SubagentSchema;
}

export interface SubagentToolApi {
  appendEntry: (type: string, data: unknown) => void;
  registerTool: (tool: SubagentToolDefinition) => void;
  zod: SubagentZod;
}

interface SubagentDispatchApi {
  appendEntry: (type: string, data: unknown) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const recordAndPersist = (
  pi: SubagentDispatchApi,
  state: MaestriaState,
  from: string,
  to: string,
  taskText: string,
): void => {
  const updatedState = recordSpecialistDelegated(recordHandoff(state, from, to, taskText), to);
  Object.assign(state, updatedState);
  persistState(pi, state);
};

const validateOmpParams = (params: {
  agent?: string;
  task?: string;
  tasks?: { agent: string; task: string }[];
  mode?: string;
}): void => {
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    if (typeof params.agent !== 'string') {
      throw new TypeError('Unknown agent: undefined');
    }
    validateAgent(params.agent);
    validateTask(params.task, 'Task description is required');
  } else {
    if (!params.tasks || params.tasks.length < 2) {
      throw new Error('For parallel/chain mode, tasks array is required with at least 2 items');
    }
    for (const t of params.tasks) {
      validateAgent(t.agent);
      validateTask(t.task, 'Task description is required for all tasks');
    }
  }
};

const handleSingleDispatch = (
  pi: SubagentDispatchApi,
  state: MaestriaState,
  params: { agent: string; task: string },
): { content: [{ text: string; type: 'text' }] } => {
  recordAndPersist(pi, state, 'orchestrator', params.agent, params.task);
  return {
    content: [
      {
        text: `## Delegation: ${params.agent}\n\nUse the native \`task\` tool to dispatch:\n\`\`\`\ntask(agent: "${params.agent}", task: """${params.task}""")\n\`\`\``,
        type: 'text' as const,
      },
    ],
  };
};

const handleMultiDispatch = (
  pi: SubagentDispatchApi,
  state: MaestriaState,
  params: { tasks: { agent: string; task: string }[]; mode: 'parallel' | 'chain' },
): { content: [{ text: string; type: 'text' }] } => {
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
};

const executeSubagent = async (
  pi: SubagentDispatchApi,
  state: MaestriaState,
  params: SubagentToolParams,
): Promise<SubagentToolResult> => {
  await Promise.resolve();
  if (state.reviewMode) {
    return {
      content: [
        {
          text: 'Subagent dispatch is not available during review mode. Use /restore-model to exit review mode first.',
          type: 'text',
        },
      ],
    };
  }
  validateOmpParams(params);
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    if (typeof params.agent !== 'string' || typeof params.task !== 'string') {
      throw new TypeError('Single mode requires an agent and task');
    }
    return handleSingleDispatch(pi, state, { agent: params.agent, task: params.task });
  }
  return handleMultiDispatch(pi, state, {
    mode,
    tasks: params.tasks ?? [],
  });
};

const createSubagentTool = (pi: SubagentToolApi, state: MaestriaState): SubagentToolDefinition => ({
  description:
    'Dispatch a task to a maestria specialist subagent (adventurer, architect, builder, diagnose, planner, reviewer, writer). Uses omp native task tool.',
  async execute(
    _toolCallId: string,
    params: SubagentToolParams,
    _signal: AbortSignal | undefined,
    _onUpdate: unknown,
    _ctx: unknown,
  ): Promise<SubagentToolResult> {
    return await executeSubagent(pi, state, params);
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

const isSubagentToolParams = (value: unknown): value is SubagentToolParams => {
  if (!isRecord(value)) {
    return false;
  }
  const { agent, mode, task, tasks } = value;
  return (
    (agent === undefined || typeof agent === 'string') &&
    (task === undefined || typeof task === 'string') &&
    (mode === undefined || mode === 'parallel' || mode === 'chain' || mode === 'single') &&
    (tasks === undefined || Array.isArray(tasks))
  );
};

export const installNativeSubagentTool = (
  pi: ExtensionAPI,
  state: MaestriaState,
  _cleanups?: (() => void)[],
): void => {
  pi.registerTool({
    description:
      'Dispatch a task to a maestria specialist subagent (adventurer, architect, builder, diagnose, planner, reviewer, writer). Uses omp native task tool.',
    execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
      if (!isSubagentToolParams(params)) {
        throw new TypeError('Invalid maestria_subagent parameters');
      }
      return await executeSubagent(pi, state, params);
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
};

export const installSubagentTool = (
  pi: SubagentToolApi,
  state: MaestriaState,
  _cleanups?: (() => void)[],
): void => {
  pi.registerTool(createSubagentTool(pi, state));

  // No subagent lifecycle event subscriptions needed - omp's built-in task tool
  // handles all dispatch lifecycle natively.
};
