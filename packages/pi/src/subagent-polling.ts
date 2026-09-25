import { setTimeout as sleep } from 'node:timers/promises';

/** Terminal subagent statuses - agent will produce no more updates. */
const TERMINAL_STATUSES = new Set(['completed', 'steered', 'aborted', 'stopped', 'error']);

export const POLL_TIMEOUT_MS = 180_000;
export const POLL_INTERVAL_MS = 500;

export interface SubagentRecord {
  status: string;
  result?: string;
  error?: string;
}

export type SubagentPollFailureReason = 'aborted' | 'timeout' | 'missing';

/**
 * Typed failure from the polling boundary, shaped like the previous
 * error-channel value ({_tag, id, reason}) so callers keep the same
 * handoff fallback context.
 */
export class SubagentPollError extends Error {
  readonly _tag = 'SubagentPollError' as const;
  readonly id: string;
  readonly reason: SubagentPollFailureReason;

  constructor(args: { id: string; message: string; reason: SubagentPollFailureReason }) {
    super(args.message);
    this.name = 'SubagentPollError';
    this.id = args.id;
    this.reason = args.reason;
  }
}

export interface SubagentPollingService {
  getRecord: (id: string) => SubagentRecord | undefined;
  abort?: (id: string) => boolean;
}

export interface PollSubagentOptions {
  readonly id: string;
  readonly label: string;
  readonly sendUpdates: boolean;
  readonly service: SubagentPollingService;
  readonly signal?: AbortSignal;
  readonly onUpdate?: (result: { content: { type: string; text: string }[] }) => void;
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
}

/**
 * Poll one subagent until it reaches a terminal status, the record goes
 * missing, the poll budget runs out, or the host aborts the tool call.
 *
 * The first record is read immediately; each interval re-reads, emits a
 * progress update, and counts toward Math.ceil(timeoutMs / intervalMs).
 * A host abort is observed at the next sleep boundary (within one
 * interval) rather than by interrupting the sleep itself.
 */
export const pollSubagent = async (options: PollSubagentOptions): Promise<SubagentRecord> => {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? POLL_TIMEOUT_MS;
  const maxPolls = Math.ceil(timeoutMs / intervalMs);
  const { id, label, sendUpdates, service, signal } = options;
  const aborted = (): SubagentPollError =>
    new SubagentPollError({ id, message: 'Maestria subagent call aborted', reason: 'aborted' });
  const throwIfAborted = (): void => {
    if (signal?.aborted === true) {
      throw aborted();
    }
  };

  const poll = async (
    record: SubagentRecord | undefined,
    polls: number,
  ): Promise<SubagentRecord> => {
    if (record === undefined) {
      throw new SubagentPollError({
        id,
        message: `Subagent ${id} was cleaned up before completion`,
        reason: 'missing',
      });
    }
    if (TERMINAL_STATUSES.has(record.status)) {
      return record;
    }
    if (polls >= maxPolls) {
      throw new SubagentPollError({
        id,
        message: `Subagent ${id} timed out after ${timeoutMs}ms`,
        reason: 'timeout',
      });
    }
    throwIfAborted();
    await sleep(intervalMs);
    throwIfAborted();
    const next = service.getRecord(id);
    const nextPolls = polls + 1;
    if (sendUpdates) {
      options.onUpdate?.({
        content: [
          {
            text: `${label} running... (${Math.round((nextPolls * intervalMs) / 1000)}s)`,
            type: 'text' as const,
          },
        ],
      });
    }
    return await poll(next, nextPolls);
  };

  return await poll(service.getRecord(id), 0);
};

/**
 * Poll with the shared interval/timeout defaults, aborting the subagent
 * when the poll fails. Used by the single and chain dispatch paths.
 */
export const pollWithDefaults = async (
  service: SubagentPollingService,
  id: string,
  label: string,
  sendUpdates: boolean,
  signal: AbortSignal | undefined,
  onUpdate: PollSubagentOptions['onUpdate'],
): Promise<SubagentRecord> => {
  try {
    return await pollSubagent({
      id,
      intervalMs: POLL_INTERVAL_MS,
      label,
      onUpdate,
      sendUpdates,
      service,
      signal,
      timeoutMs: POLL_TIMEOUT_MS,
    });
  } catch (error) {
    try {
      service.abort?.(id);
    } catch {
      // Best-effort cleanup
    }
    throw error;
  }
};
