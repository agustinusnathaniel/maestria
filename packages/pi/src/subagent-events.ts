import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
import { MAESTRIA_EVENTS } from '@maestria/shared-pi/subagent-utils';

import type { MaestriaState } from '@/state.js';
import { persistState } from '@/state.js';

export interface SubagentEventHost {
  appendEntry: (type: string, data: unknown) => void;
  events?: {
    emit: (event: string, data: unknown) => void;
    on: (event: string, handler: (data: unknown) => void) => () => void;
  } | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getStringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value[key];
  return typeof field === 'string' ? field : undefined;
};

type PiEvents = NonNullable<SubagentEventHost['events']>;

const subscribeStarted = (
  events: PiEvents,
  pi: SubagentEventHost,
  state: MaestriaState,
): (() => void) =>
  events.on(SUBAGENT_EVENTS.STARTED, (data: unknown) => {
    const id = getStringField(data, 'id');
    const type = getStringField(data, 'type') ?? 'unknown';
    if (id === undefined) {
      return;
    }
    state.subagentStatus[id] = { startedAt: Date.now(), status: 'running', type };
    persistState(pi, state);
    events.emit(MAESTRIA_EVENTS.SUBAGENT_STARTED, { id, timestamp: Date.now(), type });
  });

const subscribeCompleted = (
  events: PiEvents,
  pi: SubagentEventHost,
  state: MaestriaState,
): (() => void) =>
  events.on(SUBAGENT_EVENTS.COMPLETED, (data: unknown) => {
    const id = getStringField(data, 'id');
    if (id === undefined) {
      return;
    }
    const existing = state.subagentStatus[id];
    if (existing !== null && existing !== undefined) {
      existing.status = 'completed';
      existing.completedAt = Date.now();
    }
    persistState(pi, state);
    events.emit(MAESTRIA_EVENTS.SUBAGENT_COMPLETED, {
      id,
      timestamp: Date.now(),
      type: existing?.type,
    });
  });

const subscribeFailed = (
  events: PiEvents,
  pi: SubagentEventHost,
  state: MaestriaState,
): (() => void) =>
  events.on(SUBAGENT_EVENTS.FAILED, (data: unknown) => {
    const id = getStringField(data, 'id');
    if (id === undefined) {
      return;
    }
    const status = getStringField(data, 'status') ?? 'error';
    const existing = state.subagentStatus[id];
    if (existing !== null && existing !== undefined) {
      existing.status = status;
      existing.completedAt = Date.now();
    }
    persistState(pi, state);
    events.emit(MAESTRIA_EVENTS.SUBAGENT_FAILED, {
      id,
      timestamp: Date.now(),
      type: existing?.type,
    });
  });

const subscribeSteered = (
  events: PiEvents,
  pi: SubagentEventHost,
  state: MaestriaState,
): (() => void) =>
  events.on(SUBAGENT_EVENTS.STEERED, (data: unknown) => {
    const id = getStringField(data, 'id');
    if (id === undefined) {
      return;
    }
    state.subagentStatus[id] ??= { startedAt: Date.now(), status: 'running', type: 'unknown' };
    persistState(pi, state);
  });

export const subscribeSubagentEvents = (
  pi: SubagentEventHost,
  state: MaestriaState,
  cleanups?: (() => void)[],
): void => {
  const { events } = pi;
  if (events === null || events === undefined) {
    return;
  }
  const subscriptions = [
    subscribeStarted(events, pi, state),
    subscribeCompleted(events, pi, state),
    subscribeFailed(events, pi, state),
    subscribeSteered(events, pi, state),
  ];
  cleanups?.push(...subscriptions);
};
