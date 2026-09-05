import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { platforms } from '@/lib/platforms.js';
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

  it('VALID_PLATFORMS derives from handler registry (no drift) but preserves legacy ordering', () => {
    const handlerIds = platforms.map((p) => p.id);
    // Set membership must match registry
    expect([...validation.VALID_PLATFORMS].toSorted()).toEqual([...handlerIds].toSorted());
    expect(validation.VALID_PLATFORMS.length).toBe(handlerIds.length);
    expect(new Set(validation.VALID_PLATFORMS)).toEqual(new Set(handlerIds));
  });

  it('VALID_PLATFORMS preserves legacy exact order (opencode, omp, pi, prime-agent, ...)', () => {
    expect(validation.VALID_PLATFORMS).toEqual([
      'opencode',
      'omp',
      'pi',
      'prime-agent',
      'kimi-code',
      'hermes',
      'cursor',
      'claude-code',
      'codex',
      'deepseek',
    ]);
  });

  it('validation remains case-insensitive and trims', async () => {
    expect(await Effect.runPromise(validation.validatePlatform('  OpEnCoDe  '))).toBe('opencode');
    expect(await Effect.runPromise(validation.validatePlatform('PI'))).toBe('pi');
  });

  it('validation rejects unknown platform with message listing valid platforms in legacy order', async () => {
    const result = await Effect.runPromiseExit(validation.validatePlatform('unknown'));
    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      const { Cause } = await import('effect');
      const fail = result.cause.reasons.find(Cause.isFailReason) as
        | { error: { message: string } }
        | undefined;
      expect(fail?.error.message).toBe(
        "Unknown platform 'unknown'. Valid platforms: opencode, omp, pi, prime-agent, kimi-code, hermes, cursor, claude-code, codex, deepseek",
      );
    }
  });

  it('validatePlatforms error message preserves legacy ordering', async () => {
    const result = await Effect.runPromiseExit(validation.validatePlatforms('opencode,unknown'));
    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      const { Cause } = await import('effect');
      const fail = result.cause.reasons.find(Cause.isFailReason) as
        | { error: { message: string } }
        | undefined;
      expect(fail?.error.message).toBe(
        "Unknown platform 'unknown'. Valid platforms: opencode, omp, pi, prime-agent, kimi-code, hermes, cursor, claude-code, codex, deepseek",
      );
    }
  });

  it('validatePlatforms deduplicates and trims comma-separated list', async () => {
    expect(
      await Effect.runPromise(validation.validatePlatforms(' opencode , pi , opencode ')),
    ).toEqual(['opencode', 'pi']);
  });
});
