import { Cause, Data, Effect, Exit } from 'effect';

import { CliError } from './command-result.js';
import { PLATFORM_IDS, platforms } from './platforms.js';
import type { PlatformId } from './platforms.js';
import { isValidVersion } from './version.js';

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
}> {}

export type ValidPlatform = PlatformId;

// Ordering follows the legacy help/error order; membership comes from the registry.
const LEGACY_INDEX = new Map<ValidPlatform, number>(
  PLATFORM_IDS.map((id, idx) => [id, idx] as const),
);

// Single source for membership, sorted to preserve prior message ordering.
export const VALID_PLATFORMS: readonly ValidPlatform[] = platforms
  .map((p) => p.id)
  .toSorted((a, b) => (LEGACY_INDEX.get(a) ?? 999) - (LEGACY_INDEX.get(b) ?? 999));

const isValidPlatform = (id: string): id is ValidPlatform =>
  (VALID_PLATFORMS as readonly string[]).includes(id);

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

/** First typed failure's string `message`, or undefined when none is present. */
export const failureMessage = (cause: Cause.Cause<unknown>): string | undefined => {
  const failure: unknown = cause.reasons.find(Cause.isFailReason)?.error;
  if (typeof failure !== 'object' || failure === null || !('message' in failure)) {
    return undefined;
  }
  return typeof failure.message === 'string' ? failure.message : undefined;
};

/** Run a validation effect at the CLI boundary (failure becomes CliError exit 1). */
export const validateOrThrow = async <A>(effect: Effect.Effect<A, ValidationError>): Promise<A> => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  throw new CliError(failureMessage(exit.cause) ?? 'Validation failed', 1);
};
