import { describe, it, expect } from 'vite-plus/test';
import { Effect } from 'effect';
import * as validation from '@/lib/validation.js';

describe('validation', () => {
  it('exports ValidationError class', () => {
    expect(validation.ValidationError).toBeDefined();
  });
  it('exports validatePlatform function', () => {
    expect(typeof validation.validatePlatform).toBe('function');
  });
  it('exports validateOrExit function', () => {
    expect(typeof validation.validateOrExit).toBe('function');
  });
  it('accepts prime-agent as a valid platform', async () => {
    expect(await Effect.runPromise(validation.validatePlatform('prime-agent'))).toBe('prime-agent');
    expect(await Effect.runPromise(validation.validatePlatforms('opencode,prime-agent'))).toEqual([
      'opencode',
      'prime-agent',
    ]);
  });
});
