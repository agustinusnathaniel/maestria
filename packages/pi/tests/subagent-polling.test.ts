import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { pollSubagentEffect } from '@/subagent-polling.js';
import type { SubagentRecord } from '@/subagent-polling.js';

const service = (getRecord: (id: string) => SubagentRecord | undefined) => ({
  getRecord,
});

describe('pollSubagentEffect', () => {
  it('returns a terminal record without waiting', async () => {
    const record = { result: 'done', status: 'completed' };

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
          service: service(() => {}),
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
        intervalMs: 5,
        label: 'builder',
        sendUpdates: false,
        service: service(() => ({ status: 'running' })),
        signal: controller.signal,
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
          intervalMs: 1,
          label: 'builder',
          sendUpdates: false,
          service: service(() => ({ status: 'running' })),
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
