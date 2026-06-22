import type { ModeKeyword } from './modes.js';

export interface MaestriaState {
  mode: ModeKeyword | null;
}

export function createInitialState(): MaestriaState {
  return { mode: null };
}
