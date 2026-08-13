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

/** Maximum time to wait for a subagent to complete, in milliseconds. */
export const POLL_TIMEOUT_MS = 180_000;

/** Interval between subagent status checks, in milliseconds. */
export const POLL_INTERVAL_MS = 500;

/** Maximum number of tasks allowed in parallel dispatch. */
export const MAX_PARALLEL_TASKS = 8;

function abortSubagents(service: SubagentPollingService, ids: readonly string[]): void {
  if (typeof service.abort !== 'function') return;

  for (const id of ids) {
    try {
      service.abort(id);
    } catch {
      // Best-effort cleanup: the original polling failure remains authoritative.
    }
  }
}

function pollSubagentOrAbortEffect(options: Parameters<typeof pollSubagentEffect>[0]) {
  return Effect.tapError(pollSubagentEffect(options), () =>
    Effect.sync(() => abortSubagents(options.service, [options.id])),
  );
}

// ── Handoff recording helper ────────────────────────────────────

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
        Type.Array(
          Type.Object({
            agent: Type.String(),
            task: Type.String(),
          }),
          { description: 'Array of task objects for parallel or chain dispatch' },
        ),
      ),
      mode: Type.Optional(
        Type.Union([Type.Literal('parallel'), Type.Literal('chain'), Type.Literal('single')]),
      ),
    }),
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

      // Determine dispatch mode (default to 'single' for backward compat)
      const mode = params.mode ?? 'single';

      // Validate parameters based on mode
      if (mode === 'single') {
        if (!params.agent || !ALLOWED_AGENT_NAMES.includes(params.agent)) {
          return {
            content: [
              {
                type: 'text' as const,
                text:
                  `Invalid maestria_subagent call: 'agent' is required and must be one of ` +
                  `${ALLOWED_AGENT_NAMES.join(', ')}. ` +
                  `Re-dispatch with a valid agent name; the orchestrator may continue read-only exploration while the brief is corrected.`,
              },
            ],
          };
        }
        assertNonEmptyTask(params.task, 'Task description is required');
      } else if (mode === 'parallel') {
        if (!params.tasks || params.tasks.length < 2) {
          throw new Error(`For parallel mode, tasks array is required with at least 2 items`);
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

      // Attempt to dispatch via @gotgenes/pi-subagents; handle missing service
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
        // --- SINGLE MODE ---
        if (mode === 'single') {
          const agent = params.agent!;
          const task = params.task!;

          // Spawn in foreground - returns subagent ID synchronously
          const id = service.spawn(agent, task, {
            description: task.slice(0, 80),
            foreground: true,
            inheritContext: true,
          });

          // Record handoff in state and persist (only after spawn succeeds)
          recordAndPersist(pi, state, agent, task);

          // Poll for completion (abort on poll failure so nothing is orphaned)
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

          const resultText = record.result ?? record.error ?? 'No output.';

          return {
            content: [{ type: 'text' as const, text: resultText }],
            details: { subagentId: id },
          };
        }

        // --- PARALLEL MODE ---
        if (mode === 'parallel') {
          const taskList = params.tasks!;

          onUpdate?.({
            content: [
              { type: 'text' as const, text: `Spawning ${taskList.length} parallel subagents...` },
            ],
          });

          // Spawn all tasks
          const spawnedIds: string[] = [];
          for (const t of taskList) {
            const id = service.spawn(t.agent, t.task, {
              description: t.task.slice(0, 80),
              foreground: true,
              inheritContext: true,
            });
            spawnedIds.push(id);

            // Record each handoff
            recordAndPersist(pi, state, t.agent, t.task);
          }

          // Poll all concurrently, preserving completed results when one poll fails.
          // A failed poll aborts every sibling so no subagent is orphaned.
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
              {
                type: 'text' as const,
                text: `All ${taskList.length} parallel subagents settled.`,
              },
            ],
          });

          // Aggregate results
          const parts = [`## Parallel Results (${taskList.length} tasks)\n`];
          for (let i = 0; i < taskList.length; i++) {
            const t = taskList[i];
            const outcome = outcomes[i];
            const header = `### ${i + 1}: ${t.agent}`;
            if ('error' in outcome) {
              const message =
                outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
              parts.push(header);
              parts.push(`⚠️ ${message}`);
            } else {
              const resultText = outcome.record.result ?? outcome.record.error ?? 'No output.';
              parts.push(header);
              parts.push(resultText);
            }
          }

          return {
            content: [{ type: 'text' as const, text: parts.join('\n\n') }],
            details: { subagentIds: spawnedIds },
          };
        }

        // --- CHAIN MODE ---
        if (mode === 'chain') {
          const taskList = params.tasks!;
          let previousResult = '';

          for (let i = 0; i < taskList.length; i++) {
            const t = taskList[i];
            let taskText = t.task;

            // Substitute {previous} placeholder with previous result
            if (i > 0 && taskText.includes('{previous}')) {
              taskText = taskText.replace(/\{previous\}/g, previousResult);
            }

            const id = service.spawn(t.agent, taskText, {
              description: taskText.slice(0, 80),
              foreground: true,
              inheritContext: true,
            });

            // Record handoff
            recordAndPersist(pi, state, t.agent, taskText);

            onUpdate?.({
              content: [
                {
                  type: 'text' as const,
                  text: `Chain step ${i + 1}/${taskList.length}: ${t.agent} running...`,
                },
              ],
            });

            // Poll for completion (abort on poll failure so nothing is orphaned)
            try {
              const record = await Effect.runPromise(
                pollSubagentOrAbortEffect({
                  id,
                  label: `Chain step ${i + 1}: ${t.agent}`,
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
                    text: `Chain step ${i + 1}/${taskList.length}: ${t.agent} completed. Moving to next step.`,
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

        // Should not reach here - all modes are handled above
        throw new Error('Unknown dispatch mode');
      } catch (err) {
        console.warn('[maestria] Subagent dispatch failed:', err);
        // Return handoff payload as structured text when dispatch fails
        const agentName = params.agent ?? params.tasks?.[0]?.agent ?? 'unknown';
        const taskDesc = params.task ?? params.tasks?.map((t) => t.task).join('; ') ?? 'unknown';
        const handoffInfo = [
          `## Subagent Handoff Required`,
          ``,
          `**From:** orchestrator`,
          `**To:** ${agentName}`,
          `**Task:** ${taskDesc}`,
          ``,
          `Subagent dispatch failed. Please delegate this work manually.`,
        ].join('\n');

        return {
          content: [{ type: 'text' as const, text: handoffInfo }],
        };
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any); // TypeBox inferred types don't match ToolDefinition exactly

  // Subscribe to subagent lifecycle events for accurate state tracking.
  // These subscriptions are set up once at extension init, not on every tool call.
  // pi.events is the shared EventBus - distinct from pi.on() lifecycle hooks.
  if (pi.events) {
    const unsubStarted = pi.events.on(SUBAGENT_EVENTS.STARTED, (data: unknown) => {
      const { id, type } = data as { id: string; type: string };
      state.subagentStatus[id] = { type, status: 'running', startedAt: Date.now() };
      persistState(pi, state);
      pi.events?.emit(MAESTRIA_EVENTS.SUBAGENT_STARTED, {
        id,
        type,
        timestamp: Date.now(),
      });
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
      // Steering is informational - no status transition, but ensure
      // the agent is tracked as running if it wasn't already observed.
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
}
