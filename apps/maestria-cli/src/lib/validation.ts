import { Data, Effect, Exit, Cause } from 'effect';
import { isValidVersion } from './version.js';

// ── Errors ───────────────────────────────────────────
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
}> {}

// ── Validators ───────────────────────────────────────

const VALID_PLATFORMS = ['opencode', 'pi', 'kimi-code'] as const;
export type ValidPlatform = (typeof VALID_PLATFORMS)[number];

/**
 * Validate a platform ID string.
 * Returns the validated platform ID or fails with ValidationError.
 */
export function validatePlatform(input: string): Effect.Effect<ValidPlatform, ValidationError> {
  const normalized = input.trim().toLowerCase();
  if (!VALID_PLATFORMS.includes(normalized as ValidPlatform)) {
    return Effect.fail(
      new ValidationError({
        message: `Unknown platform '${input}'. Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
      }),
    );
  }
  return Effect.succeed(normalized as ValidPlatform);
}

/**
 * Validate a version string.
 * Accepts semver (0.5.0) or 'latest'.
 */
export function validateVersion(input: string): Effect.Effect<string, ValidationError> {
  const trimmed = input.trim();
  if (isValidVersion(trimmed)) return Effect.succeed(trimmed);
  return Effect.fail(
    new ValidationError({
      message: `Invalid version '${input}'. Use semver format (e.g., 0.5.0) or 'latest'.`,
    }),
  );
}

/**
 * Check that --all and a platform positional aren't both provided.
 */
export function validateNotAllAndPlatform(
  all: boolean,
  platform?: string,
): Effect.Effect<void, ValidationError> {
  if (all && platform) {
    return Effect.fail(
      new ValidationError({
        message: 'Cannot use --all with a specific platform. Choose one.',
      }),
    );
  }
  return Effect.void;
}

/**
 * Run a validation effect at the CLI boundary.
 * Prints the error and exits with code 1 on failure, returns the value on success.
 */
export async function validateOrExit<A>(effect: Effect.Effect<A, ValidationError>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const firstFailure = exit.cause.reasons.find(Cause.isFailReason);
  console.error(firstFailure?.error?.message ?? 'Validation failed');
  process.exit(1);
}
