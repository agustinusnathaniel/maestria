import { installCompactionHandlers as installHandlers } from '@maestria/shared-pi/compaction-core';
import type {
  ExtensionAPI,
  SessionBeforeCompactEvent,
  SessionBeforeCompactResult,
  SessionBeforeTreeEvent,
  SessionBeforeTreeResult,
} from '@oh-my-pi/pi-coding-agent';

import type { MaestriaState } from '@/state.js';

export type CompactionApi = Parameters<typeof installHandlers>[0];

interface CompactionEvent {
  preparation?: {
    firstKeptEntryId?: string;
    tokensBefore?: number;
  };
}

interface TreeEvent {
  preparation?: {
    userWantsSummary?: boolean;
  };
}

interface CompactionResult {
  compaction?: {
    details?: unknown;
    firstKeptEntryId: string;
    summary: string;
    tokensBefore: number;
  };
}

interface TreeResult {
  summary?: {
    summary: string;
    details?: unknown;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toCompactResult = (value: unknown): SessionBeforeCompactResult => {
  const result = isRecord(value) ? value : {};
  const compaction = isRecord(result.compaction) ? result.compaction : {};
  const compactResult: NonNullable<SessionBeforeCompactResult['compaction']> = {
    firstKeptEntryId:
      typeof compaction.firstKeptEntryId === 'string' ? compaction.firstKeptEntryId : '',
    summary: typeof compaction.summary === 'string' ? compaction.summary : '',
    tokensBefore: typeof compaction.tokensBefore === 'number' ? compaction.tokensBefore : 0,
  };
  if ('details' in compaction) {
    compactResult.details = compaction.details;
  }
  return { compaction: compactResult };
};

const toTreeResult = (value: unknown): SessionBeforeTreeResult | undefined => {
  if (!isRecord(value) || !isRecord(value.summary) || typeof value.summary.summary !== 'string') {
    return {};
  }
  const summary: NonNullable<SessionBeforeTreeResult['summary']> = {
    summary: value.summary.summary,
  };
  if ('details' in value.summary) {
    summary.details = value.summary.details;
  }
  return { summary };
};

export const createCompactionApi = (pi: ExtensionAPI): CompactionApi => {
  const on = (
    ...args:
      | ['session_before_compact', (event: CompactionEvent) => CompactionResult]
      | ['session_before_tree', (event: TreeEvent) => TreeResult | undefined]
  ): void => {
    const [event, handler] = args;
    if (event === 'session_before_compact') {
      pi.on('session_before_compact', (eventData: SessionBeforeCompactEvent) =>
        toCompactResult(handler(eventData)),
      );
    }
    if (event === 'session_before_tree') {
      pi.on('session_before_tree', (eventData: SessionBeforeTreeEvent) =>
        toTreeResult(handler(eventData)),
      );
    }
  };
  return { on };
};

export const installCompactionHandlers = (pi: CompactionApi, state: MaestriaState): void => {
  installHandlers(pi, state);
};
