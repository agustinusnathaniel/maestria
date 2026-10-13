import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { CliError } from '@/lib/command-result.js';
import { isRecord, parseJsonValue } from '@/lib/primitives.js';

/**
 * Legacy cleanup through the external `skills` CLI (pinned `1.7.0`).
 *
 * Tool quirks (verified against skills@1.7.0): exit code 0 is unreliable
 * (invalid agents exit 0 with an `Invalid agents:` marker); `list --json`
 * reports `source: null` with unreliable `agents`, so ownership comes from
 * our record plus observed name/path; `remove` has no `--json` and exit 0
 * means the command ran, not that anything was removed (confirm by
 * re-listing); scoped removal of a shared canonical path deletes the
 * directory while another agent still references it, so callers guard shared
 * paths.
 */

export const SKILLS_CLI_VERSION = '1.7.0';
export const SKILLS_CLI_PACKAGE = `skills@${SKILLS_CLI_VERSION}`;
export const COMPANION_SKILL = 'create-pull-request';
export const DOCS_UPDATE_SKILL = 'docs-update';
export const MANAGED_SKILLS: readonly string[] = [COMPANION_SKILL, DOCS_UPDATE_SKILL];

/** Platform ID to skills-CLI agent ID. omp aliases to `universal`. */
const COMPANION_AGENTS: Record<string, string | null> = {
  'claude-code': 'claude-code',
  codex: 'codex',
  cursor: 'cursor',
  hermes: 'hermes-agent',
  'kimi-code': 'kimi-code-cli',
  omp: 'universal',
  opencode: 'opencode',
  pi: 'pi',
};

export const companionAgentFor = (platformId: string): string | null =>
  COMPANION_AGENTS[platformId] ?? null;

export const KNOWN_COMPANION_AGENTS: readonly string[] = [
  ...new Set(Object.values(COMPANION_AGENTS).filter((agent): agent is string => agent !== null)),
];

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
  // oxlint-disable-next-line no-control-regex -- strips ANSI/spinner output.
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

// oxlint-disable-next-line strict-void-return -- unused ChildProcess return.
const execFileAsync = promisify(execFile);

export const runSkillsCli = async (
  args: readonly string[],
  options?: { cwd?: string },
): Promise<SkillCommandResult> => {
  const command = `npx -y ${SKILLS_CLI_PACKAGE} ${args.join(' ')}`;
  try {
    return await execFileAsync('npx', ['-y', SKILLS_CLI_PACKAGE, ...args], {
      cwd: options?.cwd,
      encoding: 'utf-8',
      timeout: 120_000,
    });
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
}

export interface ObservedCompanion {
  readonly name: string;
  readonly path: string;
}

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

/** Exit 0 plus a post-`list` check; absent skill is a no-op. */
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
