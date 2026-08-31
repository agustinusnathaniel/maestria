import type { AgentToolUpdateCallback } from '@earendil-works/pi-coding-agent';
import {
  ALLOWED_AGENTS,
  assertNonEmptyTask as assertTaskContract,
  assertValidAgent,
} from '@maestria/shared-pi/subagent-utils';
import { Effect } from 'effect';
import { Type } from 'typebox';
import type { Static } from 'typebox';

import type { MaestriaState } from '@/state.js';
import { persistState, recordHandoff, recordSpecialistDelegated } from '@/state.js';
import { pollSubagentEffect } from '@/subagent-polling.js';
import type { SubagentPollingService, SubagentRecord } from '@/subagent-polling.js';
import { subscribeSubagentEvents } from '@/subagent-events.js';
import type { SubagentEventHost } from '@/subagent-events.js';

const ALLOWED_AGENT_NAMES: readonly string[] = ALLOWED_AGENTS;

export const POLL_TIMEOUT_MS = 180_000;
export const POLL_INTERVAL_MS = 500;
export const MAX_PARALLEL_TASKS = 8;

type SubagentSpawnService = SubagentPollingService & {
  spawn: (
    agent: string,
    task: string,
    opts: { description: string; foreground: boolean; inheritContext: boolean },
  ) => string;
};

interface SubagentTask {
  agent: string;
  task: string;
}
export interface SubagentParams {
  agent?: string;
  task?: string;
  tasks?: SubagentTask[];
  mode?: string;
}
interface ToolUpdate {
  content: { type: string; text: string }[];
  details?: Record<string, unknown>;
}
type ToolUpdateHandler = ((result: ToolUpdate) => void) | undefined;
export type PiToolUpdateHandler = AgentToolUpdateCallback<Record<string, unknown>> | undefined;
export interface ToolResult {
  content: { text: string; type: 'text' }[];
  details: Record<string, unknown>;
}

export interface SubagentToolDefinition {
  description: string;
  execute: (
    toolCallId: string,
    params: SubagentParams,
    signal: AbortSignal | undefined,
    onUpdate: PiToolUpdateHandler,
    ctx: unknown,
  ) => Promise<ToolResult>;
  label: string;
  name: string;
  parameters: typeof SUBAGENT_PARAMETERS;
  promptGuidelines?: string[];
  promptSnippet?: string;
}

export interface SubagentToolApi extends SubagentEventHost {
  registerTool: (tool: SubagentToolDefinition) => void;
}

const assertTask: (task: string | undefined, label: string) => asserts task is string =
  assertTaskContract;
const assertAgent: (agent: string) => void = assertValidAgent;

const abortSubagents = (service: SubagentPollingService, ids: readonly string[]): void => {
  if (typeof service.abort !== 'function') {
    return;
  }
  for (const id of ids) {
    try {
      service.abort(id);
    } catch {
      // Best-effort cleanup
    }
  }
};

const pollSubagentOrAbortEffect = (options: Parameters<typeof pollSubagentEffect>[0]) =>
  Effect.tapError(pollSubagentEffect(options), () =>
    Effect.sync(() => {
      abortSubagents(options.service, [options.id]);
    }),
  );

const recordAndPersist = (
  pi: SubagentEventHost,
  state: MaestriaState,
  agentName: string,
  taskText: string,
): void => {
  const updatedState = recordSpecialistDelegated(
    recordHandoff(state, 'orchestrator', agentName, taskText),
    agentName,
  );
  Object.assign(state, updatedState);
  persistState(pi, state);
};

const validatePiParams = (params: SubagentParams): string => {
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    if (
      params.agent === undefined ||
      params.agent === null ||
      params.agent === '' ||
      !ALLOWED_AGENT_NAMES.includes(params.agent)
    ) {
      return `Invalid maestria_subagent call: 'agent' is required and must be one of ${ALLOWED_AGENT_NAMES.join(', ')}.`;
    }
    assertTask(params.task, 'Task description is required');
  } else if (mode === 'parallel') {
    if (!params.tasks || params.tasks.length < 2) {
      throw new Error('For parallel mode, tasks array is required with at least 2 items');
    }
    if (params.tasks.length > MAX_PARALLEL_TASKS) {
      throw new Error(
        `For parallel mode, tasks array may have at most ${MAX_PARALLEL_TASKS} items (got ${params.tasks.length})`,
      );
    }
    for (const t of params.tasks) {
      assertAgent(t.agent);
      assertTask(t.task, 'Task description is required for all tasks');
    }
  } else if (mode === 'chain') {
    if (!params.tasks || params.tasks.length < 2) {
      throw new Error('For chain mode, tasks array is required with at least 2 items');
    }
    for (const t of params.tasks) {
      assertAgent(t.agent);
      assertTask(t.task, 'Task description is required for all tasks');
    }
  }
  return mode;
};

const handleSingleMode = async (
  pi: SubagentEventHost,
  state: MaestriaState,
  service: SubagentSpawnService,
  agent: string,
  task: string,
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
): Promise<ToolResult> => {
  const id = service.spawn(agent, task, {
    description: task.slice(0, 80),
    foreground: true,
    inheritContext: true,
  });
  recordAndPersist(pi, state, agent, task);
  const record = await Effect.runPromise(
    pollSubagentOrAbortEffect({
      id,
      intervalMs: POLL_INTERVAL_MS,
      label: `Subagent ${agent}`,
      onUpdate,
      sendUpdates: true,
      service,
      signal,
      timeoutMs: POLL_TIMEOUT_MS,
    }),
  );
  return {
    content: [{ text: record.result ?? record.error ?? 'No output.', type: 'text' as const }],
    details: { subagentId: id },
  };
};

type ParallelOutcome = { error: unknown } | { record: SubagentRecord };

const spawnParallelSubagents = (
  pi: SubagentEventHost,
  state: MaestriaState,
  service: SubagentSpawnService,
  taskList: SubagentTask[],
): string[] => {
  const spawnedIds: string[] = [];
  try {
    for (const task of taskList) {
      const id = service.spawn(task.agent, task.task, {
        description: task.task.slice(0, 80),
        foreground: true,
        inheritContext: true,
      });
      spawnedIds.push(id);
      recordAndPersist(pi, state, task.agent, task.task);
    }
  } catch (error) {
    abortSubagents(service, spawnedIds);
    throw error;
  }
  return spawnedIds;
};

const pollParallelSubagents = async (
  spawnedIds: string[],
  taskList: SubagentTask[],
  service: SubagentSpawnService,
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
): Promise<ParallelOutcome[]> =>
  await Effect.runPromise(
    Effect.all(
      spawnedIds.map((id, index) => {
        const task = taskList[index];
        return Effect.match(
          pollSubagentEffect({
            id,
            intervalMs: POLL_INTERVAL_MS,
            label: `${task.agent} (${index + 1}/${taskList.length})`,
            onUpdate,
            sendUpdates: false,
            service,
            signal,
            timeoutMs: POLL_TIMEOUT_MS,
          }),
          {
            onFailure: (error) => {
              abortSubagents(service, spawnedIds);
              return { error };
            },
            onSuccess: (record) => ({ record }),
          },
        );
      }),
      { concurrency: 'unbounded' },
    ),
  );

const renderParallelResults = (
  taskList: SubagentTask[],
  spawnedIds: string[],
  outcomes: ParallelOutcome[],
): ToolResult => {
  const parts = [`## Parallel Results (${taskList.length} tasks)\n`];
  for (const [index, task] of taskList.entries()) {
    const outcome = outcomes[index];
    parts.push(`### ${index + 1}: ${task.agent}`);
    if ('error' in outcome) {
      parts.push(
        `⚠️ ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`,
      );
    } else {
      parts.push(outcome.record.result ?? outcome.record.error ?? 'No output.');
    }
  }
  return {
    content: [{ text: parts.join('\n\n'), type: 'text' as const }],
    details: { subagentIds: spawnedIds },
  };
};

const handleParallelMode = async (
  pi: SubagentEventHost,
  state: MaestriaState,
  service: SubagentSpawnService,
  taskList: SubagentTask[],
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
): Promise<ToolResult> => {
  onUpdate?.({
    content: [{ text: `Spawning ${taskList.length} parallel subagents...`, type: 'text' }],
  });
  const spawnedIds = spawnParallelSubagents(pi, state, service, taskList);
  const outcomes = await pollParallelSubagents(spawnedIds, taskList, service, signal, onUpdate);
  onUpdate?.({
    content: [{ text: `All ${taskList.length} parallel subagents settled.`, type: 'text' }],
  });
  return renderParallelResults(taskList, spawnedIds, outcomes);
};

const substitutePreviousResult = (taskText: string, previousResult: string): string =>
  taskText.replaceAll('{previous}', () => previousResult);

const runChainSteps = async (
  pi: SubagentEventHost,
  state: MaestriaState,
  service: SubagentSpawnService,
  taskList: SubagentTask[],
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
  index: number,
  previousResult: string,
): Promise<string> => {
  if (index >= taskList.length) {
    return previousResult;
  }

  const task = taskList[index];
  const taskText = index > 0 ? substitutePreviousResult(task.task, previousResult) : task.task;
  const id = service.spawn(task.agent, taskText, {
    description: taskText.slice(0, 80),
    foreground: true,
    inheritContext: true,
  });
  recordAndPersist(pi, state, task.agent, taskText);
  onUpdate?.({
    content: [
      {
        text: `Chain step ${index + 1}/${taskList.length}: ${task.agent} running...`,
        type: 'text',
      },
    ],
  });

  let nextResult: string;
  try {
    const record = await Effect.runPromise(
      pollSubagentOrAbortEffect({
        id,
        intervalMs: POLL_INTERVAL_MS,
        label: `Chain step ${index + 1}: ${task.agent}`,
        onUpdate,
        sendUpdates: true,
        service,
        signal,
        timeoutMs: POLL_TIMEOUT_MS,
      }),
    );
    nextResult = record.result ?? record.error ?? 'No output.';
  } catch (error) {
    return `[error] ${error instanceof Error ? error.message : String(error)}`;
  }

  if (index < taskList.length - 1) {
    onUpdate?.({
      content: [
        {
          text: `Chain step ${index + 1}/${taskList.length}: ${task.agent} completed. Moving to next step.`,
          type: 'text',
        },
      ],
    });
  }

  return await runChainSteps(pi, state, service, taskList, signal, onUpdate, index + 1, nextResult);
};

const handleChainMode = async (
  pi: SubagentEventHost,
  state: MaestriaState,
  service: SubagentSpawnService,
  taskList: SubagentTask[],
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
): Promise<ToolResult> => ({
  content: [
    {
      text: await runChainSteps(pi, state, service, taskList, signal, onUpdate, 0, ''),
      type: 'text',
    },
  ],
  details: { subagentId: 'chain-completed' },
});

const dispatchByMode = async (
  pi: SubagentEventHost,
  state: MaestriaState,
  service: SubagentSpawnService,
  params: SubagentParams,
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
): Promise<ToolResult> => {
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    if (typeof params.agent !== 'string' || typeof params.task !== 'string') {
      throw new TypeError('Single mode requires an agent and task');
    }
    return await handleSingleMode(pi, state, service, params.agent, params.task, signal, onUpdate);
  }
  if ((mode === 'parallel' || mode === 'chain') && Array.isArray(params.tasks)) {
    return await (mode === 'parallel'
      ? handleParallelMode(pi, state, service, params.tasks, signal, onUpdate)
      : handleChainMode(pi, state, service, params.tasks, signal, onUpdate));
  }
  throw new Error('Unknown dispatch mode');
};

export const SUBAGENT_PARAMETERS = Type.Object({
  agent: Type.String({
    description:
      'Specialist agent name (required): adventurer, architect, builder, diagnose, planner, reviewer, writer',
  }),
  mode: Type.Optional(
    Type.Union([Type.Literal('parallel'), Type.Literal('chain'), Type.Literal('single')]),
  ),
  task: Type.String({ description: 'Task description for the subagent (required)' }),
  tasks: Type.Optional(
    Type.Array(Type.Object({ agent: Type.String(), task: Type.String() }), {
      description: 'Array of task objects for parallel or chain dispatch',
    }),
  ),
});

export type SubagentToolParams = Static<typeof SUBAGENT_PARAMETERS>;

const unavailableResult = (): ToolResult => ({
  content: [
    {
      text: [
        '## Subagent Dispatch Unavailable',
        '',
        'The `@gotgenes/pi-subagents` extension is required for subagent dispatch but has not been loaded.',
        '',
        'Install it as a Pi extension:',
        '',
        '```',
        'pi install npm:@gotgenes/pi-subagents',
        '```',
        '',
        'Then restart your Pi session.',
      ].join('\n'),
      type: 'text',
    },
  ],
  details: {},
});

const handoffResult = (agentName: string, taskDesc: string): ToolResult => ({
  content: [
    {
      text: [
        '## Subagent Handoff Required',
        '',
        '**From:** orchestrator',
        `**To:** ${agentName}`,
        `**Task:** ${taskDesc}`,
        '',
        'Subagent dispatch failed. Please delegate this work manually.',
      ].join('\n'),
      type: 'text',
    },
  ],
  details: {},
});

const executeSubagent = async (
  pi: SubagentEventHost,
  state: MaestriaState,
  params: SubagentParams,
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdateHandler,
): Promise<ToolResult> => {
  const { getSubagentsService } = await import('@gotgenes/pi-subagents');
  const service = getSubagentsService();
  if (!service || typeof service.spawn !== 'function') {
    return unavailableResult();
  }
  try {
    return await dispatchByMode(pi, state, service, params, signal, onUpdate);
  } catch (error) {
    console.warn('[maestria] Subagent dispatch failed:', error);
    const agentName = params.agent ?? params.tasks?.[0]?.agent ?? 'unknown';
    const taskDesc = params.task ?? params.tasks?.map((task) => task.task).join('; ') ?? 'unknown';
    return handoffResult(agentName, taskDesc);
  }
};

const createSubagentTool = (
  pi: SubagentEventHost,
  state: MaestriaState,
): SubagentToolDefinition => ({
  description: 'Dispatch a task to a @gotgenes/pi-subagents specialist subagent',
  async execute(
    _toolCallId: string,
    params: SubagentParams,
    signal: AbortSignal | undefined,
    onUpdate: PiToolUpdateHandler,
    _ctx: unknown,
  ): Promise<ToolResult> {
    if (state.reviewMode) {
      return {
        content: [
          {
            text: 'Subagent dispatch is not available during review mode. Use /restore-model to exit review mode first.',
            type: 'text',
          },
        ],
        details: {},
      };
    }
    const mode = validatePiParams(params);
    if (mode.startsWith('Invalid')) {
      return {
        content: [
          {
            text: `${mode} Re-dispatch with a valid agent name; the orchestrator may continue read-only exploration while the brief is corrected.`,
            type: 'text',
          },
        ],
        details: {},
      };
    }
    const updateHandler: ToolUpdateHandler = onUpdate
      ? (result) => {
          onUpdate({
            content: result.content.map(({ text }) => ({ text, type: 'text' as const })),
            details: result.details ?? {},
          });
        }
      : undefined;
    return await executeSubagent(pi, state, params, signal, updateHandler);
  },
  label: 'Maestria Subagent',
  name: 'maestria_subagent',
  parameters: SUBAGENT_PARAMETERS,
  promptGuidelines: [
    'Use maestria_subagent when a task MUST be delegated to a specialist subagent rather than handled directly. Each specialist has focused capabilities: adventurer (recon), architect (design), builder (impl), planner (planning), diagnose (bugs), reviewer (QA), writer (docs).',
  ],
  promptSnippet:
    'Delegate tasks to @maestria specialist subagents (adventurer, architect, builder, planner, diagnose, reviewer, writer)',
});

export const installSubagentTool = (
  pi: SubagentToolApi,
  state: MaestriaState,
  cleanups?: (() => void)[],
): void => {
  pi.registerTool(createSubagentTool(pi, state));
  subscribeSubagentEvents(pi, state, cleanups);
};
