import type { ReplaceOp } from './config.js';

const SPECIALIST_REFERENCE_NAMES = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

export const specialistReferenceReplacements = (targetPrefix = ''): ReplaceOp[] =>
  SPECIALIST_REFERENCE_NAMES.map((name) => ({
    from: `@${name}`,
    to: `${targetPrefix}${name}`,
  }));
