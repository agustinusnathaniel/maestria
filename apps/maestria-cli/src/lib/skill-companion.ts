import { execFile } from 'node:child_process';
import { Effect } from 'effect';

import { CliError } from '@/lib/command-result.js';
import { isRecord, parseJsonValue } from '@/lib/primitives.js';

/**
 * Companion skill installation through the external `skills` CLI (pinned
 * `1.7.0`). The CLI never copies skill bodies and keeps no path registry:
 * path identity always comes from the tool's own machine output.
 *
 * Tool quirks (verified against skills@1.7.0): exit code 0 is unreliable
 * (invalid agents exit 0 with an `Invalid agents:` marker); `list --json`
 * always reports `source: null` with unreliable `agents`, so ownership comes
 * from our own record plus observed name/path; `remove` supports no `--json`
 * and exit 0 means the command ran, not that anything was removed (confirm by
 * re-listing); scoped removal of a shared canonical path
 * (`~/.agents/skills/<skill>`) deletes the directory even while another agent
 * still references it, so callers guard removal while another owned platform
 * shares the observed path.
 */

export const SKILLS_CLI_VERSION = '1.7.0';
export const SKILLS_CLI_PACKAGE = `skills@${SKILLS_CLI_VERSION}`;
export const SKILLS_SOURCE = 'agustinusnathaniel/maestria';
export const COMPANION_SKILL = 'create-pull-request';
export const DOCS_UPDATE_SKILL = 'docs-update';
export const MANAGED_SKILLS: readonly string[] = [COMPANION_SKILL, DOCS_UPDATE_SKILL];

/**
 * Maestria platform ID to native skills-CLI agent ID. `null` means no
 * companion target exists. omp and prime-agent alias to `universal`: their
 * hosts natively discover `~/.agents/skills/` SKILL.md directories.
 */
const COMPANION_AGENTS: Record<string, string | null> = {
  'claude-code': 'claude-code',
  codex: 'codex',
  cursor: 'cursor',
  hermes: 'hermes-agent',
  'kimi-code': 'kimi-code-cli',
  omp: 'universal',
  opencode: 'opencode',
  pi: 'pi',
  'prime-agent': 'universal',
};

export const companionAgentFor = (platformId: string): string | null =>
  COMPANION_AGENTS[platformId] ?? null;

export const KNOWN_COMPANION_AGENTS: readonly string[] = [
  ...new Set(Object.values(COMPANION_AGENTS).filter((agent): agent is string => agent !== null)),
];

export const isCompanionSupported = (platformId: string): boolean =>
  companionAgentFor(platformId) !== null;

export interface SkillCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type SkillCommandRunner = (
  args: readonly string[],
  options?: { cwd?: string },
) => Promise<SkillCommandResult>;

const MAX_ERROR_DETAIL = 1000;

const stripAnsi = (value: string): string =>
  // oxlint-disable-next-line no-control-regex -- intentional ANSI/spinner stripping for child output.
  value.replaceAll(/\u001B\[[0-9;?]*[A-Za-z]|\u001B\?25[hl]/gu, '');

const sanitizeDetail = (value: string): string =>
  stripAnsi(value).replaceAll(/\s+/gu, ' ').trim().slice(0, MAX_ERROR_DETAIL);

const extractTrailingJson = (stdout: string): unknown => {
  const clean = stripAnsi(stdout);
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) {
    return undefined;
  }
  return parseJsonValue(clean.slice(start, end + 1));
};

const extractJsonArray = (stdout: string): unknown => {
  const parsed = extractTrailingJson(stdout);
  return Array.isArray(parsed) ? parsed : undefined;
};

const assertKnownAgent = (stdout: string, args: readonly string[]): void => {
  if (stripAnsi(stdout).includes('Invalid agents:')) {
    throw new CliError(
      `skills CLI rejected the agent for '${args.join(' ')}': ${sanitizeDetail(stdout)}`,
      1,
    );
  }
};

interface CompanionEntry {
  readonly name?: unknown;
  readonly path?: unknown;
  readonly status?: unknown;
}

const asEntry = (value: unknown): CompanionEntry | null =>
  isRecord(value) ? { name: value.name, path: value.path, status: value.status } : null;

export const runSkillsCli = async (
  args: readonly string[],
  options?: { cwd?: string },
): Promise<SkillCommandResult> => {
  const command = `npx -y ${SKILLS_CLI_PACKAGE} ${args.join(' ')}`;
  try {
    return await Effect.runPromise(
      Effect.callback<SkillCommandResult, Error>((resume) => {
        execFile(
          'npx',
          ['-y', SKILLS_CLI_PACKAGE, ...args],
          { cwd: options?.cwd, encoding: 'utf-8', timeout: 120_000 },
          (error, stdout, stderr) => {
            if (error) {
              resume(Effect.fail(Object.assign(error, { stderr, stdout })));
              return;
            }
            resume(Effect.succeed({ stderr, stdout }));
          },
        );
      }),
    );
  } catch (error) {
    const stderr = isRecord(error) && typeof error.stderr === 'string' ? error.stderr : '';
    const stdout = isRecord(error) && typeof error.stdout === 'string' ? error.stdout : '';
    const detail =
      (stderr === '' ? stdout : stderr) ||
      (error instanceof Error ? error.message : 'skills CLI failed with no output');
    throw new CliError(`skills CLI failed (${command}): ${sanitizeDetail(detail)}`, 1);
  }
};

export interface CompanionScope {
  readonly global?: boolean;
}

const scopeArgs = (scope?: CompanionScope): string[] => (scope?.global === false ? [] : ['-g']);

export interface CompanionRef {
  readonly agent: string;
  readonly skill?: string;
  readonly source?: string;
}

export interface InstalledCompanion {
  readonly path: string;
}

/** Never runs a bare broad `skills update`. */
export const addCompanion = async (
  runner: SkillCommandRunner,
  ref: CompanionRef,
  scope?: CompanionScope,
): Promise<InstalledCompanion> => {
  const skill = ref.skill ?? COMPANION_SKILL;
  const source = ref.source ?? SKILLS_SOURCE;
  const args = ['add', source, '-a', ref.agent, '-s', skill, ...scopeArgs(scope), '--json', '-y'];
  const output = await runner(args);
  assertKnownAgent(output.stdout, args);
  const parsed = extractJsonArray(output.stdout);
  const match = Array.isArray(parsed)
    ? parsed
        .map(asEntry)
        .find((entry) => entry !== null && entry.name === skill && entry.status === 'installed')
    : undefined;
  if (match?.path !== undefined && typeof match.path === 'string') {
    return { path: match.path };
  }
  throw new CliError(
    `skills CLI did not confirm install of '${skill}' for agent '${ref.agent}': ${sanitizeDetail(output.stdout)}`,
    1,
  );
};

export interface ObservedCompanion {
  readonly name: string;
  readonly path: string;
}

/**
 * List installed skills for one native target. Returns tool-observed
 * name/path inventory only; callers combine this with their own record.
 */
export const listCompanions = async (
  runner: SkillCommandRunner,
  agent: string,
  scope?: CompanionScope,
): Promise<ObservedCompanion[]> => {
  const args = ['list', '-a', agent, ...scopeArgs(scope), '--json'];
  const output = await runner(args);
  assertKnownAgent(output.stdout, args);
  const parsed = extractJsonArray(output.stdout);
  if (!Array.isArray(parsed)) {
    throw new CliError(
      `skills CLI list did not return JSON for agent '${agent}': ${sanitizeDetail(output.stdout)}`,
      1,
    );
  }
  return parsed.flatMap((entry) => {
    const candidate = asEntry(entry);
    if (
      candidate !== null &&
      typeof candidate.name === 'string' &&
      typeof candidate.path === 'string'
    ) {
      return [{ name: candidate.name, path: candidate.path }];
    }
    return [];
  });
};

/**
 * Remove one managed skill from one native target. Success is the validated
 * exit plus a post-`list` check, never prose parsing; an absent skill is a
 * successful no-op. Callers guard shared canonical paths before invoking.
 */
export const removeCompanion = async (
  runner: SkillCommandRunner,
  ref: CompanionRef,
  scope?: CompanionScope,
): Promise<{ removed: boolean }> => {
  const skill = ref.skill ?? COMPANION_SKILL;
  const removeArgs = ['remove', skill, '-a', ref.agent, ...scopeArgs(scope), '-y'];
  const output = await runner(removeArgs);
  assertKnownAgent(output.stdout, removeArgs);
  const otherwise = stripAnsi(output.stdout).includes('No skills found to remove');
  const remaining = await listCompanions(runner, ref.agent, scope);
  const stillPresent = remaining.some((entry) => entry.name === skill);
  if (stillPresent) {
    throw new CliError(
      `skills CLI removal of '${skill}' for agent '${ref.agent}' exited 0 but the skill is still listed: ${sanitizeDetail(output.stdout)}`,
      1,
    );
  }
  return { removed: !otherwise };
};
