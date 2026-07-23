import type { MaestriaState } from './types.js';

export function persistState(
  pi: { appendEntry: (type: string, data: unknown) => void },
  state: MaestriaState,
): void {
  pi.appendEntry('maestria_state', { ...state });
}
