import type {
  ExtensionAPI,
  SessionBeforeCompactEvent,
  SessionBeforeTreeEvent,
} from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from '@/state.js';
import { renderMaestriaSummary } from '@/state.js';

export function installCompactionHandlers(pi: ExtensionAPI, state: MaestriaState): void {
  pi.on('session_before_compact', (event: SessionBeforeCompactEvent) => {
    return {
      compaction: {
        summary: renderMaestriaSummary(state),
        firstKeptEntryId: event.preparation.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    };
  });

  pi.on('session_before_tree', (event: SessionBeforeTreeEvent) => {
    if (event.preparation.userWantsSummary) {
      return {
        summary: {
          summary: renderMaestriaSummary(state),
        },
      };
    }
    return undefined;
  });
}
