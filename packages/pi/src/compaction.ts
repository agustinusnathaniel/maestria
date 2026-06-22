import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { MaestriaState } from './state.js';
import { renderMaestriaSummary } from './state.js';

export function installCompactionHandlers(pi: ExtensionAPI, state: MaestriaState): void {
  (pi as unknown as { on: (event: string, handler: (...args: any[]) => any) => void }).on(
    'session_before_compact',
    () => {
      return { compaction: { summary: renderMaestriaSummary(state) } };
    },
  );

  (pi as unknown as { on: (event: string, handler: (...args: any[]) => any) => void }).on(
    'session_before_tree',
    (event: { userWantsSummary?: boolean }) => {
      if (event.userWantsSummary) {
        return renderMaestriaSummary(state);
      }
      return undefined;
    },
  );
}
