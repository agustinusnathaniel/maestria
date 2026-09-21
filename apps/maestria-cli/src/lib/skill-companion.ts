import { execFile } from 'node:child_process';
import { Effect } from 'effect';

import { CliError } from '@/lib/command-result.js';
import { isRecord, parseJsonValue } from '@/lib/primitives.js';

/**
 * Companion skill installation through the external `skills` CLI.
 *
 * Maestria-owned methodology skills live once at the repository root
 * (`skills/<skill>/SKILL.md`). The CLI never copies skill bodies, never
 * symlinks them, and never keeps its own path registry: it installs or
 * removes companions through the official skills CLI (pinned `1.7.0` from
 * `https://github.com/vercel-labs/skills.git`), scoped to one known managed
 * skill, source, and native target per operation. Path identity always comes
 * from the tool's own machine output (`add --json`, `list --json`); this
 * module hardcodes no target directories.
 *
 * Verified behavior (isolated HOME/XDG/npm-cache, skills@1.7.0; see
 * `/tmp/opencode/skills-cli-sandbox-evidence.md`):
 * - `add <source> -a <agent> -s <skill> -g --json -y` installs globally and
 *   prints a trailing JSON array with `{name, status, source, path, ...}`;
 *   re-adding is idempotent (`status: "installed"` again). Exit code 0 is
 *   unreliable: invalid agents also exit 0 with an `Invalid agents:` marker.
 * - `list -a <agent> -g --json` prints a JSON array with `{name, path,
 *   scope, ...}`; `source` is always null and `agents` is unreliable, so
 *   ownership comes from our own record plus observed name/path, never from
 *   those fields. `add --list` rejects `--json`; never combine them.
 * - `remove <skill> -a <agent> -g -y` prints human text only (no JSON even
 *   with `--json`); exit 0 means the command ran, not that anything was
 *   removed. Absent skills exit 0 with `No skills found to remove.`
 *   Removal is confirmed by re-listing, never by parsing prose.
 * - Scoped removal of a shared canonical path (`~/.agents/skills/<skill>`,
 *   used by opencode/codex/cursor/kimi-code-cli and by omp/prime-agent via
 *   the `universal` target) deletes the directory even while another agent
 *   still references it, so callers must guard removal while another owned
 *   platform shares the observed path.
 * - Default remote source `agustinusnathaniel/maestria` resolves only after
 *   this feature merges; until then pass a local root checkout as the
 *   source. Never claim the remote skill exists before release ordering
 *   completes.
 */

export const SKILLS_CLI_VERSION = '1.7.0';
export const SKILLS_CLI_PACKAGE = `skills@${SKILLS_CLI_VERSION}`;
/** Default remote source; unavailable until this feature merges to main. */
export const SKILLS_SOURCE = 'agustinusnathaniel/maestria';
export const COMPANION_SKILL = 'create-pull-request';
/** Second managed methodology skill: documentation-impact assessment. */
export const DOCS_UPDATE_SKILL = 'docs-update';
/** Every skill this CLI version knows how to install, update, or remove. */
export const MANAGED_SKILLS: readonly string[] = [COMPANION_SKILL, DOCS_UPDATE_SKILL];

/**
 * Maestria platform ID to native skills-CLI agent ID. `null` means no
 * companion target exists and is reserved for unknown IDs (verified against
 * skills@1.7.0's valid-agent list, which carries neither `omp` nor
 * `prime-agent`). Both are aliased to `universal` because their hosts
 * natively discover `~/.agents/skills/` SKILL.md directories with no config
 * writes: Prime per E-PRIME-04, and OMP per the pinned pi-coding-agent 17.4
 * source (`src/discovery/agents.ts`: `AGENT_DIR_CANDIDATES` covers `.agent`
 * and `.agents`, `loadSkills` scans `~/.agent/skills` and `~/.agents/skills`
 * with `enableAgentsUser` defaulting to true, and `scanSkillsFromDir` loads
 * `<name>/SKILL.md` subdirectories, the exact shape the CLI installs).
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

/** Distinct native agent IDs the adapter can observe with list --json. */
export const KNOWN_COMPANION_AGENTS: readonly string[] = [
  ...new Set(Object.values(COMPANION_AGENTS).filter((agent): agent is string => agent !== null)),
];

export const isCompanionSupported = (platformId: string): boolean =>
  companionAgentFor(platformId) !== null;

export interface SkillCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

/** Injected command runner so tests never touch the real HOME or network. */
export type SkillCommandRunner = (
  args: readonly string[],
  options?: { cwd?: string },
) => Promise<SkillCommandResult>;

const MAX_ERROR_DETAIL = 1000;

const stripAnsi = (value: string): string =>
  // Single regex: CSI sequences plus the residual cursor hide/show markers.
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

/** Exit 0 is unreliable: invalid agents exit 0 with an `Invalid agents:` marker. */
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

const entryConfirmsInstall = (entry: CompanionEntry, skill: string): boolean =>
  entry.name === skill && entry.status === 'installed';

/** Child failure fields, when the runtime attaches them to the rejection. */
const failureOutput = (error: unknown): string => {
  const stderr = isRecord(error) && typeof error.stderr === 'string' ? error.stderr : '';
  const stdout = isRecord(error) && typeof error.stdout === 'string' ? error.stdout : '';
  const detail = stderr === '' ? stdout : stderr;
  if (detail !== '') {
    return detail;
  }
  return error instanceof Error ? error.message : 'skills CLI failed with no output';
};

/** Default runner: pinned skills CLI over npx, child stdio piped (no spinner leak). */
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
    throw new CliError(
      `skills CLI failed (${command}): ${sanitizeDetail(failureOutput(error))}`,
      1,
    );
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
  /** Native path observed in the tool's own `add --json` output. */
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
    ? parsed.map(asEntry).find((entry) => entry !== null && entryConfirmsInstall(entry, skill))
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
 * List installed skills for one native target (ownership checks before
 * writes). Returns tool-observed name/path inventory only; the CLI reports
 * no reliable source or per-agent attribution, so callers combine this with
 * their own ownership record.
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
 * Remove one managed skill from one native target. `remove` supports no
 * `--json` (verified: the flag is ignored and output stays human-readable),
 * so success is the validated exit plus a post-`list` observational check,
 * never prose parsing. An absent skill is a successful no-op. Callers must
 * guard shared canonical paths before invoking: scoped removal deletes the
 * shared directory even while another agent still references it.
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
