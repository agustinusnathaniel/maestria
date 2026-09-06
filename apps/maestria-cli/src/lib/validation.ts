import { Cause, Data, Effect, Exit } from 'effect';

import { PLATFORM_IDS, platforms } from './platforms.js';
import type { PlatformId } from './platforms.js';
import { isValidVersion } from './version.js';

// ── Errors ───────────────────────────────────────────
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
}> {}

// ── Validators ───────────────────────────────────────

// Re-export the literal-typed platform ID union from the handler registry.
export type ValidPlatform = PlatformId;

// Legacy presentation order preserved for help text and error messages
// (opencode, omp, pi, prime-agent, kimi-code, hermes, cursor, claude-code, codex, deepseek).
// Membership is derived from `platforms` registry; ordering follows the legacy
// order so existing messages remain stable.
const LEGACY_ORDER: readonly ValidPlatform[] = PLATFORM_IDS;

const LEGACY_INDEX = new Map<ValidPlatform, number>(
  LEGACY_ORDER.map((id, idx) => [id, idx] as const),
);

// Derived from the canonical handler registry - single source for membership.
// Sorted by LEGACY_ORDER to preserve prior help/error message ordering.
export const VALID_PLATFORMS: readonly ValidPlatform[] = platforms
  .map((p) => p.id)
  .toSorted((a, b) => (LEGACY_INDEX.get(a) ?? 999) - (LEGACY_INDEX.get(b) ?? 999));

const isValidPlatform = (id: string): id is ValidPlatform =>
  (VALID_PLATFORMS as readonly string[]).includes(id);

/**
 * Validate a platform ID string.
 * Returns the validated platform ID or fails with ValidationError.
 */
export const validatePlatform = (input: string): Effect.Effect<ValidPlatform, ValidationError> => {
  const normalized = input.trim().toLowerCase();
  if (!isValidPlatform(normalized)) {
    return Effect.fail(
      new ValidationError({
        message: `Unknown platform '${input}'. Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
      }),
    );
  }
  return Effect.succeed(normalized);
};

/**
 * Validate a comma-separated list of platform IDs.
 * Splits on comma, trims whitespace, validates each.
 * Returns an array of validated platform IDs or fails on the first invalid one.
 */
export const validatePlatforms = (
  input: string,
): Effect.Effect<ValidPlatform[], ValidationError> => {
  const parts = [
    ...new Set(
      input
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (parts.length === 0) {
    return Effect.fail(
      new ValidationError({
        message: 'No platforms specified.',
      }),
    );
  }
  const results: ValidPlatform[] = [];
  for (const part of parts) {
    if (!isValidPlatform(part)) {
      return Effect.fail(
        new ValidationError({
          message: `Unknown platform '${part}'. Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
        }),
      );
    }
    results.push(part);
  }
  return Effect.succeed(results);
};

/**
 * Validate a version string.
 * Accepts semver (0.5.0) or 'latest'.
 */
export const validateVersion = (input: string): Effect.Effect<string, ValidationError> => {
  const trimmed = input.trim();
  if (isValidVersion(trimmed)) {
    return Effect.succeed(trimmed);
  }
  return Effect.fail(
    new ValidationError({
      message: `Invalid version '${input}'. Use semver format (e.g., 0.5.0) or 'latest'.`,
    }),
  );
};

/**
 * Run a validation effect at the CLI boundary.
 * Prints the error and exits with code 1 on failure, returns the value on success.
 */
export const validateOrExit = async <A>(effect: Effect.Effect<A, ValidationError>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const firstFailure = exit.cause.reasons.find(Cause.isFailReason);
  console.error(firstFailure?.error?.message ?? 'Validation failed');
  return process.exit(1);
};
