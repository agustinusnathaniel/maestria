import { Type } from 'typebox';
import { Effect } from 'effect';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
import type { MaestriaState } from '@/state.js';
import { persistState, recordHandoff, recordSpecialistDelegated } from '@/state.js';
import {
  ALLOWED_AGENTS,
  assertValidAgent,
  assertNonEmptyTask,
  MAESTRIA_EVENTS,
} from '@maestria/shared-pi/subagent-utils';
import { pollSubagentEffect, type SubagentPollingService } from '@/subagent-polling.js';

const ALLOWED_AGENT_NAMES: ReadonlyArray<string> = ALLOWED_AGENTS;

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

function abortSubagents(service: SubagentPollingService, ids: readonly string[]): void {
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
}

function pollSubagentOrAbortEffect(options: Parameters<typeof pollSubagentEffect>[0]) {
  return Effect.tapError(pollSubagentEffect(options), () =>
    Effect.sync(() => abortSubagents(options.service, [options.id])),
  );
}

function recordAndPersist(
  pi: ExtensionAPI,
  state: MaestriaState,
  agentName: string,
  taskText: string,
): void {
  const updatedState = recordSpecialistDelegated(
    recordHandoff(state, 'orchestrator', agentName, taskText),
    agentName,
  );
  Object.assign(state, updatedState);
  persistState(pi, state);
}

function validatePiParams(params: {
  agent?: string;
  task?: string;
  tasks?: Array<{ agent: string; task: string }>;
  mode?: string;
}): string {
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    if (!params.agent || !ALLOWED_AGENT_NAMES.includes(params.agent)) {
      return `Invalid maestria_subagent call: 'agent' is required and must be one of ${ALLOWED_AGENT_NAMES.join(', ')}.`;
    }
    assertNonEmptyTask(params.task, 'Task description is required');
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
      assertValidAgent(t.agent);
      assertNonEmptyTask(t.task, 'Task description is required for all tasks');
    }
  } else if (mode === 'chain') {
    if (!params.tasks || params.tasks.length < 2) {
      throw new Error('For chain mode, tasks array is required with at least 2 items');
    }
    for (const t of params.tasks) {
      assertValidAgent(t.agent);
      assertNonEmptyTask(t.task, 'Task description is required for all tasks');
    }
  }
  return mode;
}

async function handleSingleMode(
  pi: ExtensionAPI,
  state: MaestriaState,
  service: SubagentSpawnService,
  agent: string,
  task: string,
  signal: AbortSignal | undefined,
  onUpdate: ((result: { content: Array<{ type: string; text: string }> }) => void) | undefined,
) {
  const id = service.spawn(agent, task, {
    description: task.slice(0, 80),
    foreground: true,
    inheritContext: true,
  });
  recordAndPersist(pi, state, agent, task);
  const record = await Effect.runPromise(
    pollSubagentOrAbortEffect({
      id,
      label: `Subagent ${agent}`,
      sendUpdates: true,
      service,
      signal,
      onUpdate,
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    }),
  );
  return {
    content: [{ type: 'text' as const, text: record.result ?? record.error ?? 'No output.' }],
    details: { subagentId: id },
  };
}

// oxlint-disable-next-line max-lines-per-function -- handleParallelMode orchestrates parallel subagent spawn/poll with orphan cleanup and result aggregation as a single cohesive flow; splitting would fragment the spawn/poll/aggregate sequence that shares spawnedIds/service/signal.
async function handleParallelMode(
  pi: ExtensionAPI,
  state: MaestriaState,
  service: SubagentSpawnService,
  taskList: Array<{ agent: string; task: string }>,
  signal: AbortSignal | undefined,
  onUpdate: ((result: { content: Array<{ type: string; text: string }> }) => void) | undefined,
) {
  onUpdate?.({
    content: [{ type: 'text' as const, text: `Spawning ${taskList.length} parallel subagents...` }],
  });
  const spawnedIds: string[] = [];
  try {
    for (const t of taskList) {
      const id = service.spawn(t.agent, t.task, {
        description: t.task.slice(0, 80),
        foreground: true,
        inheritContext: true,
      });
      spawnedIds.push(id);
      recordAndPersist(pi, state, t.agent, t.task);
    }
  } catch (err) {
    abortSubagents(service, spawnedIds);
    throw err;
  }
  const outcomes = await Effect.runPromise(
    Effect.all(
      spawnedIds.map((id, i) =>
        Effect.match(
          pollSubagentEffect({
            id,
            label: `${taskList[i].agent} (${i + 1}/${taskList.length})`,
            sendUpdates: false,
            service,
            signal,
            onUpdate,
            intervalMs: POLL_INTERVAL_MS,
            timeoutMs: POLL_TIMEOUT_MS,
          }),
          {
            onSuccess: (record) => ({ record }),
            onFailure: (error) => {
              abortSubagents(service, spawnedIds);
              return { error };
            },
          },
        ),
      ),
      { concurrency: 'unbounded' },
    ),
  );
  onUpdate?.({
    content: [
      { type: 'text' as const, text: `All ${taskList.length} parallel subagents settled.` },
    ],
  });
  const parts = [`## Parallel Results (${taskList.length} tasks)\n`];
  for (let i = 0; i < taskList.length; i++) {
    const t = taskList[i];
    const outcome = outcomes[i];
    parts.push(`### ${i + 1}: ${t.agent}`);
    if ('error' in outcome) {
      parts.push(
        `⚠️ ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}`,
      );
    } else {
      parts.push(outcome.record.result ?? outcome.record.error ?? 'No output.');
    }
  }
  return {
    content: [{ type: 'text' as const, text: parts.join('\n\n') }],
    details: { subagentIds: spawnedIds },
  };
}

// oxlint-disable-next-line max-lines-per-function -- handleChainMode orchestrates chained subagent spawn/poll with previous-result interpolation and step notifications as a single cohesive flow; splitting would fragment the loop that shares previousResult/service/signal.
async function handleChainMode(
  pi: ExtensionAPI,
  state: MaestriaState,
  service: SubagentSpawnService,
  taskList: Array<{ agent: string; task: string }>,
  signal: AbortSignal | undefined,
  onUpdate: ((result: { content: Array<{ type: string; text: string }> }) => void) | undefined,
) {
  let previousResult = '';
  for (let i = 0; i < taskList.length; i++) {
    let taskText = taskList[i].task;
    if (i > 0 && taskText.includes('{previous}')) {
      taskText = taskText.replace(/\{previous\}/g, () => previousResult);
    }
    const id = service.spawn(taskList[i].agent, taskText, {
      description: taskText.slice(0, 80),
      foreground: true,
      inheritContext: true,
    });
    recordAndPersist(pi, state, taskList[i].agent, taskText);
    onUpdate?.({
      content: [
        {
          type: 'text' as const,
          text: `Chain step ${i + 1}/${taskList.length}: ${taskList[i].agent} running...`,
        },
      ],
    });
    try {
      const record = await Effect.runPromise(
        pollSubagentOrAbortEffect({
          id,
          label: `Chain step ${i + 1}: ${taskList[i].agent}`,
          sendUpdates: true,
          service,
          signal,
          onUpdate,
          intervalMs: POLL_INTERVAL_MS,
          timeoutMs: POLL_TIMEOUT_MS,
        }),
      );
      previousResult = record.result ?? record.error ?? 'No output.';
    } catch (error) {
      previousResult = `[error] ${error instanceof Error ? error.message : String(error)}`;
      break;
    }
    if (i < taskList.length - 1) {
      onUpdate?.({
        content: [
          {
            type: 'text' as const,
            text: `Chain step ${i + 1}/${taskList.length}: ${taskList[i].agent} completed. Moving to next step.`,
          },
        ],
      });
    }
  }
  return {
    content: [{ type: 'text' as const, text: previousResult }],
    details: { subagentId: 'chain-completed' },
  };
}

async function dispatchByMode(
  pi: ExtensionAPI,
  state: MaestriaState,
  service: SubagentSpawnService,
  params: {
    agent?: string;
    task?: string;
    tasks?: Array<{ agent: string; task: string }>;
    mode?: string;
  },
  signal: AbortSignal | undefined,
  onUpdate: ((result: { content: Array<{ type: string; text: string }> }) => void) | undefined,
) {
  const mode = params.mode ?? 'single';
  if (mode === 'single') {
    return handleSingleMode(pi, state, service, params.agent!, params.task!, signal, onUpdate);
  }
  if (mode === 'parallel') {
    return handleParallelMode(pi, state, service, params.tasks!, signal, onUpdate);
  }
  if (mode === 'chain') {
    return handleChainMode(pi, state, service, params.tasks!, signal, onUpdate);
  }
  throw new Error('Unknown dispatch mode');
}

function subscribeSubagentEvents(
  pi: ExtensionAPI,
  state: MaestriaState,
  cleanups?: Array<() => void>,
): void {
  if (!pi.events) {
    return;
  }
  const unsubStarted = pi.events.on(SUBAGENT_EVENTS.STARTED, (data: unknown) => {
    const { id, type } = data as { id: string; type: string };
    state.subagentStatus[id] = { type, status: 'running', startedAt: Date.now() };
    persistState(pi, state);
    pi.events?.emit(MAESTRIA_EVENTS.SUBAGENT_STARTED, { id, type, timestamp: Date.now() });
  });
  const unsubCompleted = pi.events.on(SUBAGENT_EVENTS.COMPLETED, (data: unknown) => {
    const { id } = data as { id: string };
    const existing = state.subagentStatus[id];
    if (existing) {
      existing.status = 'completed';
      existing.completedAt = Date.now();
    }
    persistState(pi, state);
    pi.events?.emit(MAESTRIA_EVENTS.SUBAGENT_COMPLETED, {
      id,
      type: existing?.type,
      timestamp: Date.now(),
    });
  });
  const unsubFailed = pi.events.on(SUBAGENT_EVENTS.FAILED, (data: unknown) => {
    const { id, status } = data as { id: string; status: string };
    const existing = state.subagentStatus[id];
    if (existing) {
      existing.status = status ?? 'error';
      existing.completedAt = Date.now();
    }
    persistState(pi, state);
    pi.events?.emit(MAESTRIA_EVENTS.SUBAGENT_FAILED, {
      id,
      type: existing?.type,
      timestamp: Date.now(),
    });
  });
  const unsubSteered = pi.events.on(SUBAGENT_EVENTS.STEERED, (data: unknown) => {
    const { id } = data as { id: string };
    if (!state.subagentStatus[id]) {
      state.subagentStatus[id] = { type: 'unknown', status: 'running', startedAt: Date.now() };
    }
    persistState(pi, state);
  });
  if (cleanups) {
    cleanups.push(unsubStarted, unsubCompleted, unsubFailed, unsubSteered);
  }
}

// oxlint-disable-next-line max-lines-per-function -- installSubagentTool registers the maestria_subagent tool and subscribes to subagent lifecycle events as a single cohesive registration; splitting would fragment the tool definition and event subscriptions that share pi/state.
export function installSubagentTool(
  pi: ExtensionAPI,
  state: MaestriaState,
  cleanups?: Array<() => void>,
): void {
  pi.registerTool({
    name: 'maestria_subagent',
    label: 'Maestria Subagent',
    description: 'Dispatch a task to a @maestria specialist subagent',
    promptSnippet:
      'Delegate tasks to @maestria specialist subagents (adventurer, architect, builder, planner, diagnose, reviewer, writer)',
    promptGuidelines: [
      'Use maestria_subagent when a task MUST be delegated to a specialist subagent rather than handled directly. Each specialist has focused capabilities: adventurer (recon), architect (design), builder (impl), planner (planning), diagnose (bugs), reviewer (QA), writer (docs).',
    ],
    prepareArguments(args: unknown) {
      return args;
    },
    parameters: Type.Object({
      agent: Type.String({
        description:
          'Specialist agent name (required): adventurer, architect, builder, diagnose, planner, reviewer, writer',
      }),
      task: Type.String({ description: 'Task description for the subagent (required)' }),
      tasks: Type.Optional(
        Type.Array(Type.Object({ agent: Type.String(), task: Type.String() }), {
          description: 'Array of task objects for parallel or chain dispatch',
        }),
      ),
      mode: Type.Optional(
        Type.Union([Type.Literal('parallel'), Type.Literal('chain'), Type.Literal('single')]),
      ),
    }),
    // oxlint-disable-next-line max-lines-per-function -- execute validates params, checks reviewMode, and dispatches via @gotgenes/pi-subagents with single/parallel/chain modes sharing service/state/signal; splitting would duplicate validation and service lookup.
    async execute(
      _toolCallId: string,
      params: {
        agent?: string;
        task?: string;
        tasks?: Array<{ agent: string; task: string }>;
        mode?: 'parallel' | 'chain' | 'single';
      },
      signal: AbortSignal | undefined,
      onUpdate: ((result: { content: Array<{ type: string; text: string }> }) => void) | undefined,
      _ctx: ExtensionContext,
    ) {
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
      const mode = validatePiParams(params);
      if (typeof mode === 'string' && mode.startsWith('Invalid')) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `${mode} Re-dispatch with a valid agent name; the orchestrator may continue read-only exploration while the brief is corrected.`,
            },
          ],
        };
      }
      const { getSubagentsService } = await import('@gotgenes/pi-subagents');
      const service = getSubagentsService();
      if (!service || typeof service.spawn !== 'function') {
        return {
          content: [
            {
              type: 'text' as const,
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
            },
          ],
        };
      }
      try {
        return await dispatchByMode(
          pi,
          state,
          service as SubagentSpawnService,
          params,
          signal,
          onUpdate,
        );
      } catch (err) {
        console.warn('[maestria] Subagent dispatch failed:', err);
        const agentName = params.agent ?? params.tasks?.[0]?.agent ?? 'unknown';
        const taskDesc = params.task ?? params.tasks?.map((t) => t.task).join('; ') ?? 'unknown';
        return {
          content: [
            {
              type: 'text' as const,
              text: [
                `## Subagent Handoff Required`,
                ``,
                `**From:** orchestrator`,
                `**To:** ${agentName}`,
                `**Task:** ${taskDesc}`,
                ``,
                `Subagent dispatch failed. Please delegate this work manually.`,
              ].join('\n'),
            },
          ],
        };
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  subscribeSubagentEvents(pi, state, cleanups);
}
