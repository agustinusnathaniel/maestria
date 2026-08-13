import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import { pollSubagentEffect, type SubagentRecord } from '@/subagent-polling.js';

function service(getRecord: (id: string) => SubagentRecord | undefined) {
  return { getRecord };
}

describe('pollSubagentEffect', () => {
  it('returns a terminal record without waiting', async () => {
    const record = { status: 'completed', result: 'done' };

    await expect(
      Effect.runPromise(
        pollSubagentEffect({
          id: 'subagent-1',
          label: 'builder',
          sendUpdates: false,
          service: service(() => record),
        }),
      ),
    ).resolves.toEqual(record);
  });

  it('fails with a typed missing-record error', async () => {
    await expect(
      Effect.runPromise(
        pollSubagentEffect({
          id: 'subagent-missing',
          label: 'builder',
          sendUpdates: false,
          service: service(() => undefined),
        }),
      ),
    ).rejects.toMatchObject({
      _tag: 'SubagentPollError',
      id: 'subagent-missing',
      reason: 'missing',
    });
  });

  it('interrupts the polling fiber when the host aborts the tool call', async () => {
    const controller = new AbortController();
    const pending = Effect.runPromise(
      pollSubagentEffect({
        id: 'subagent-aborted',
        label: 'builder',
        sendUpdates: false,
        service: service(() => ({ status: 'running' })),
        signal: controller.signal,
        intervalMs: 5,
      }),
    );

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      _tag: 'SubagentPollError',
      id: 'subagent-aborted',
      reason: 'aborted',
    });
  });

  it('fails with a typed timeout error when a record never reaches a terminal state', async () => {
    await expect(
      Effect.runPromise(
        pollSubagentEffect({
          id: 'subagent-timeout',
          label: 'builder',
          sendUpdates: false,
          service: service(() => ({ status: 'running' })),
          intervalMs: 1,
          timeoutMs: 2,
        }),
      ),
    ).rejects.toMatchObject({
      _tag: 'SubagentPollError',
      id: 'subagent-timeout',
      reason: 'timeout',
    });
  });
});
