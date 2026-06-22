import { Type } from 'typebox';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
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

/** Terminal subagent statuses — agent will produce no more updates. */
const TERMINAL_STATUSES = new Set(['completed', 'steered', 'aborted', 'stopped', 'error']);

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
      agent: Type.String({ description: 'Specialist agent name' }),
      task: Type.String({ description: 'Task description for the subagent' }),
    }),
    async execute(
      _toolCallId: string,
      params: { agent: string; task: string },
      signal: AbortSignal | undefined,
      onUpdate: ((result: { content: Array<{ type: string; text: string }> }) => void) | undefined,
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

      // Attempt to dispatch via @gotgenes/pi-subagents; fallback gracefully
      try {
        const { getSubagentsService } = await import('@gotgenes/pi-subagents');
        const service = getSubagentsService();
        if (!service || typeof service.spawn !== 'function') {
          throw new Error('Subagents service unavailable or incomplete');
        }

        // Spawn in foreground — returns subagent ID synchronously
        const id = service.spawn(params.agent, params.task, {
          description: params.task.slice(0, 80),
          foreground: true,
          inheritContext: true,
        });

        // Record handoff in state and persist (only after spawn succeeds)
        const updatedState = recordHandoff(state, 'orchestrator', params.agent, params.task);
        Object.assign(state, updatedState);
        pi.appendEntry('maestria_state', state);

        // Poll for completion (SubagentRecord has no promise field)
        const POLL_TIMEOUT_MS = 60_000; // 60s max wait
        const POLL_INTERVAL_MS = 500;
        const maxPolls = POLL_TIMEOUT_MS / POLL_INTERVAL_MS;
        let polls = 0;
        let record = service.getRecord(id);
        while (record && !TERMINAL_STATUSES.has(record.status) && polls < maxPolls) {
          if (signal?.aborted) throw new Error('Maestria subagent call aborted');
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          record = service.getRecord(id);
          polls++;
          onUpdate?.({
            content: [
              {
                type: 'text' as const,
                text: `Subagent ${params.agent} running... (${Math.round((polls * POLL_INTERVAL_MS) / 1000)}s)`,
              },
            ],
          });
        }
        if (record && !TERMINAL_STATUSES.has(record.status)) {
          throw new Error(`Subagent ${id} timed out after ${POLL_TIMEOUT_MS}ms`);
        }

        if (!record) {
          throw new Error(`Subagent ${id} was cleaned up before completion`);
        }

        const resultText = record.result ?? record.error ?? 'No output.';

        return {
          content: [{ type: 'text' as const, text: resultText }],
          details: { subagentId: id },
        };
      } catch {
        // Return handoff payload as structured text when SDK unavailable
        const handoffInfo = [
          `## Subagent Handoff Required`,
          ``,
          `**From:** orchestrator`,
          `**To:** ${params.agent}`,
          `**Task:** ${params.task}`,
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
    });

    const unsubCompleted = pi.events.on(SUBAGENT_EVENTS.COMPLETED, (data: unknown) => {
      const { id } = data as { id: string };
      const existing = state.subagentStatus[id];
      if (existing) {
        existing.status = 'completed';
        existing.completedAt = Date.now();
      }
    });

    const unsubFailed = pi.events.on(SUBAGENT_EVENTS.FAILED, (data: unknown) => {
      const { id, status } = data as { id: string; status: string };
      const existing = state.subagentStatus[id];
      if (existing) {
        existing.status = status ?? 'error';
        existing.completedAt = Date.now();
      }
    });

    const unsubSteered = pi.events.on(SUBAGENT_EVENTS.STEERED, (data: unknown) => {
      // Steering is informational — no status transition, but ensure
      // the agent is tracked as running if it wasn't already observed.
      const { id } = data as { id: string };
      if (!state.subagentStatus[id]) {
        state.subagentStatus[id] = { type: 'unknown', status: 'running', startedAt: Date.now() };
      }
    });

    if (cleanups) {
      cleanups.push(unsubStarted, unsubCompleted, unsubFailed, unsubSteered);
    }
  }
}
