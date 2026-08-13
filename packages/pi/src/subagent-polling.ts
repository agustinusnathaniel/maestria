import { Data, Effect } from 'effect';

/** Terminal subagent statuses - agent will produce no more updates. */
const TERMINAL_STATUSES = new Set(['completed', 'steered', 'aborted', 'stopped', 'error']);

export type SubagentRecord = { status: string; result?: string; error?: string };

export type SubagentPollFailureReason = 'aborted' | 'timeout' | 'missing';

/**
 * Typed failures from the polling boundary.
 *
 * Keeping these failures in the Effect error channel lets parallel polling
 * interrupt sibling fibers while preserving enough context for the existing
 * tool-level handoff fallback.
 */
export class SubagentPollError extends Data.TaggedError('SubagentPollError')<{
  readonly id: string;
  readonly reason: SubagentPollFailureReason;
  readonly message: string;
}> {}

export interface SubagentPollingService {
  getRecord(id: string): SubagentRecord | undefined;
  abort?: (id: string) => boolean;
}

export interface PollSubagentOptions {
  readonly id: string;
  readonly label: string;
  readonly sendUpdates: boolean;
  readonly service: SubagentPollingService;
  readonly signal?: AbortSignal;
  readonly onUpdate?: (result: { content: Array<{ type: string; text: string }> }) => void;
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
}

function pollLoop(options: PollSubagentOptions): Effect.Effect<SubagentRecord, SubagentPollError> {
  const intervalMs = options.intervalMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const maxPolls = Math.ceil(timeoutMs / intervalMs);

  return Effect.gen(function* () {
    let polls = 0;
    let record = yield* Effect.sync(() => options.service.getRecord(options.id));

    while (record && !TERMINAL_STATUSES.has(record.status) && polls < maxPolls) {
      yield* Effect.sleep(intervalMs);
      record = yield* Effect.sync(() => options.service.getRecord(options.id));
      polls++;

      if (options.sendUpdates) {
        yield* Effect.sync(() => {
          options.onUpdate?.({
            content: [
              {
                type: 'text' as const,
                text: `${options.label} running... (${Math.round((polls * intervalMs) / 1000)}s)`,
              },
            ],
          });
        });
      }
    }

    if (record && !TERMINAL_STATUSES.has(record.status)) {
      return yield* Effect.fail(
        new SubagentPollError({
          id: options.id,
          reason: 'timeout',
          message: `Subagent ${options.id} timed out after ${timeoutMs}ms`,
        }),
      );
    }

    if (!record) {
      return yield* Effect.fail(
        new SubagentPollError({
          id: options.id,
          reason: 'missing',
          message: `Subagent ${options.id} was cleaned up before completion`,
        }),
      );
    }

    return record;
  });
}

function abortEffect(id: string, signal: AbortSignal): Effect.Effect<never, SubagentPollError> {
  return Effect.callback<never, SubagentPollError>((resume) => {
    const onAbort = () => {
      resume(
        Effect.fail(
          new SubagentPollError({
            id,
            reason: 'aborted',
            message: 'Maestria subagent call aborted',
          }),
        ),
      );
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
    return Effect.sync(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Poll one subagent as a cancellable Effect.
 *
 * The host Pi API is Promise-based, so callers cross the boundary with
 * `Effect.runPromise`. Keeping the polling workflow as an Effect gives the
 * parallel dispatcher structured cancellation: a failed or aborted poll
 * interrupts its sibling poll fibers instead of leaving timers running.
 */
export function pollSubagentEffect(
  options: PollSubagentOptions,
): Effect.Effect<SubagentRecord, SubagentPollError> {
  const poll = pollLoop(options);
  return options.signal ? Effect.raceFirst(poll, abortEffect(options.id, options.signal)) : poll;
}
