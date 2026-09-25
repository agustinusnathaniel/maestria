import { SUBAGENT_EVENTS } from '@gotgenes/pi-subagents';
import { MAESTRIA_EVENTS } from '@maestria/shared-pi/subagent-utils';

import type { MaestriaState } from '@maestria/shared-pi/state-core';
import { persistState } from '@maestria/shared-pi/state-core';

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

interface SubagentEventSpec {
  /** Host event to subscribe. */
  readonly source: string;
  /** Maestria event re-emitted after persist, or undefined for silent updates. */
  readonly target?: string;
  /** Fold the event into state; returns the specialist type for the emit payload. */
  readonly apply: (state: MaestriaState, id: string, data: unknown) => string | undefined;
}

const EVENT_SPECS: readonly SubagentEventSpec[] = [
  {
    apply: (state, id, data) => {
      const type = getStringField(data, 'type') ?? 'unknown';
      state.subagentStatus[id] = { startedAt: Date.now(), status: 'running', type };
      return type;
    },
    source: SUBAGENT_EVENTS.STARTED,
    target: MAESTRIA_EVENTS.SUBAGENT_STARTED,
  },
  {
    apply: (state, id) => {
      const existing = state.subagentStatus[id];
      if (existing !== undefined && existing !== null) {
        existing.status = 'completed';
        existing.completedAt = Date.now();
      }
      return existing?.type;
    },
    source: SUBAGENT_EVENTS.COMPLETED,
    target: MAESTRIA_EVENTS.SUBAGENT_COMPLETED,
  },
  {
    apply: (state, id, data) => {
      const status = getStringField(data, 'status') ?? 'error';
      const existing = state.subagentStatus[id];
      if (existing !== undefined && existing !== null) {
        existing.status = status;
        existing.completedAt = Date.now();
      }
      return existing?.type;
    },
    source: SUBAGENT_EVENTS.FAILED,
    target: MAESTRIA_EVENTS.SUBAGENT_FAILED,
  },
  {
    apply: (state, id) => {
      state.subagentStatus[id] ??= { startedAt: Date.now(), status: 'running', type: 'unknown' };
      return 'unknown';
    },
    source: SUBAGENT_EVENTS.STEERED,
  },
];

const subscribeSpec = (
  events: PiEvents,
  pi: SubagentEventHost,
  state: MaestriaState,
  spec: SubagentEventSpec,
): (() => void) =>
  events.on(spec.source, (data: unknown) => {
    const id = getStringField(data, 'id');
    if (id === undefined) {
      return;
    }
    const type = spec.apply(state, id, data);
    persistState(pi, state);
    if (spec.target !== undefined) {
      events.emit(spec.target, { id, timestamp: Date.now(), type });
    }
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
  // Subscribe unconditionally: cleanups only collects the teardown
  // handles, and `cleanups?.push(...)` would skip the map entirely.
  const subscriptions = EVENT_SPECS.map((spec) => subscribeSpec(events, pi, state, spec));
  cleanups?.push(...subscriptions);
};
