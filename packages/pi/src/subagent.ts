import { Type } from 'typebox';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
import type { MaestriaState } from './state.js';
import { persistState, recordHandoff } from './state.js';

/**
 * Maestria cross-extension event names.
 * Other Pi extensions can subscribe via `pi.events?.on(...)`.
 * Convention: `maestria:<domain>:<action>`
 */
export const MAESTRIA_EVENTS = {
  REVIEW_ACTIVATED: 'maestria:review:activated',
  REVIEW_DEACTIVATED: 'maestria:review:deactivated',
  SUBAGENT_STARTED: 'maestria:subagent:started',
  SUBAGENT_COMPLETED: 'maestria:subagent:completed',
  SUBAGENT_FAILED: 'maestria:subagent:failed',
} as const;

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

/** Terminal subagent statuses — agent will produce no more updates. */
const TERMINAL_STATUSES = new Set(['completed', 'steered', 'aborted', 'stopped', 'error']);

/** Maximum number of tasks allowed in parallel dispatch. */
export const MAX_PARALLEL_TASKS = 8;

export function validateHandoff(handoff: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const field of HANDOFF_FIELDS) {
    const regex = new RegExp(`\\*\\*${field}:\\*\\*[\\s\\S]*?\\S`, 'i');
    if (!regex.test(handoff)) {
      errors.push(`Missing or empty field: "${field}"`);
    }
  }
  return { valid: errors.length === 0, errors };
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
      agent: Type.Optional(Type.String({ description: 'Specialist agent name' })),
      task: Type.Optional(Type.String({ description: 'Task description for the subagent' })),
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
      // Determine dispatch mode (default to 'single' for backward compat)
      const mode = params.mode ?? 'single';

      // Validate parameters based on mode
      if (mode === 'single') {
        // Backward-compatible validation — must match original error messages exactly
        if (!ALLOWED_AGENTS.includes(params.agent as AllowedAgent)) {
          throw new Error(
            `Unknown agent: "${params.agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`,
          );
        }
        if (!params.task || !params.task.trim()) {
          throw new Error('Task description is required');
        }
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
          if (!ALLOWED_AGENTS.includes(t.agent as AllowedAgent)) {
            throw new Error(`Unknown agent: "${t.agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
          }
          if (!t.task || !t.task.trim()) {
            throw new Error('Task description is required for all tasks');
          }
        }
      } else if (mode === 'chain') {
        if (!params.tasks || params.tasks.length < 2) {
          throw new Error('For chain mode, tasks array is required with at least 2 items');
        }
        for (const t of params.tasks) {
          if (!ALLOWED_AGENTS.includes(t.agent as AllowedAgent)) {
            throw new Error(`Unknown agent: "${t.agent}". Allowed: ${ALLOWED_AGENTS.join(', ')}`);
          }
          if (!t.task || !t.task.trim()) {
            throw new Error('Task description is required for all tasks');
          }
        }
      }

      // Attempt to dispatch via @gotgenes/pi-subagents; fallback gracefully
      try {
        const { getSubagentsService } = await import('@gotgenes/pi-subagents');
        const service = getSubagentsService()!;
        if (typeof service.spawn !== 'function') {
          throw new Error('Subagents service unavailable or incomplete');
        }

        // Helper: poll a single subagent until terminal or timeout
        const POLL_TIMEOUT_MS = 60_000; // 60s max wait
        const POLL_INTERVAL_MS = 500;
        async function pollSubagent(
          id: string,
          label: string,
          sendUpdates: boolean,
        ): Promise<{ status: string; result?: string; error?: string }> {
          const maxPolls = POLL_TIMEOUT_MS / POLL_INTERVAL_MS;
          let polls = 0;
          let record = service.getRecord(id);
          while (record && !TERMINAL_STATUSES.has(record.status) && polls < maxPolls) {
            if (signal?.aborted) throw new Error('Maestria subagent call aborted');
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            record = service.getRecord(id);
            polls++;
            if (sendUpdates) {
              onUpdate?.({
                content: [
                  {
                    type: 'text' as const,
                    text: `${label} running... (${Math.round((polls * POLL_INTERVAL_MS) / 1000)}s)`,
                  },
                ],
              });
            }
          }
          if (record && !TERMINAL_STATUSES.has(record.status)) {
            throw new Error(`Subagent ${id} timed out after ${POLL_TIMEOUT_MS}ms`);
          }
          if (!record) {
            throw new Error(`Subagent ${id} was cleaned up before completion`);
          }
          return record;
        }

        // --- SINGLE MODE ---
        if (mode === 'single') {
          const agent = params.agent!;
          const task = params.task!;

          // Spawn in foreground — returns subagent ID synchronously
          const id = service.spawn(agent, task, {
            description: task.slice(0, 80),
            foreground: true,
            inheritContext: true,
          });

          // Record handoff in state and persist (only after spawn succeeds)
          const updatedState = recordHandoff(state, 'orchestrator', agent, task);
          Object.assign(state, updatedState);
          pi.appendEntry('maestria_state', state);

          // Poll for completion
          const record = await pollSubagent(id, `Subagent ${agent}`, true);

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
            const updatedState = recordHandoff(state, 'orchestrator', t.agent, t.task);
            Object.assign(state, updatedState);
          }
          pi.appendEntry('maestria_state', state);

          // Poll all concurrently
          const records = await Promise.all(
            spawnedIds.map((id, i) =>
              pollSubagent(id, `${taskList[i].agent} (${i + 1}/${taskList.length})`, false),
            ),
          );

          onUpdate?.({
            content: [
              {
                type: 'text' as const,
                text: `All ${taskList.length} parallel subagents completed.`,
              },
            ],
          });

          // Aggregate results
          const parts = [`## Parallel Results (${taskList.length} tasks)\n`];
          for (let i = 0; i < taskList.length; i++) {
            const t = taskList[i];
            const rec = records[i];
            const resultText = rec.result ?? rec.error ?? 'No output.';
            parts.push(`### ${i + 1}: ${t.agent}`);
            parts.push(resultText);
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
            const updatedState = recordHandoff(state, 'orchestrator', t.agent, taskText);
            Object.assign(state, updatedState);
            pi.appendEntry('maestria_state', state);

            onUpdate?.({
              content: [
                {
                  type: 'text' as const,
                  text: `Chain step ${i + 1}/${taskList.length}: ${t.agent} running...`,
                },
              ],
            });

            // Poll for completion
            const record = await pollSubagent(id, `Chain step ${i + 1}: ${t.agent}`, true);

            previousResult = record.result ?? record.error ?? 'No output.';

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

        // Should not reach here — all modes are handled above
        throw new Error('Unknown dispatch mode');
      } catch {
        // Return handoff payload as structured text when SDK unavailable
        const agentName = params.agent ?? params.tasks?.[0]?.agent ?? 'unknown';
        const taskDesc = params.task ?? params.tasks?.map((t) => t.task).join('; ') ?? 'unknown';
        const handoffInfo = [
          `## Subagent Handoff Required`,
          ``,
          `**From:** orchestrator`,
          `**To:** ${agentName}`,
          `**Task:** ${taskDesc}`,
          ``,
          `Subagent SDK not available. Please delegate this work manually.`,
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
  // pi.events is the shared EventBus — distinct from pi.on() lifecycle hooks.
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
      // Steering is informational — no status transition, but ensure
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
