import type { ReplaceOp } from './config.js';

const SPECIALIST_REFERENCE_NAMES = ['reviewer'] as const;

export const specialistReferenceReplacements = (targetPrefix = ''): ReplaceOp[] =>
  SPECIALIST_REFERENCE_NAMES.map((name) => ({
    from: `@${name}`,
    to: `${targetPrefix}${name}`,
  }));
