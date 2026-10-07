import { readFileSync } from 'node:fs';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const readEvidence = <T>(filename: string, valid: (value: unknown) => value is T): T => {
  const value: unknown = JSON.parse(readFileSync(filename, 'utf-8'));
  if (!valid(value)) {
    throw new Error(`Invalid evidence: ${filename}`);
  }
  return value;
};
