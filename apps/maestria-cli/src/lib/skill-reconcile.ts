import { CliError } from '@/lib/command-result.js';
import {
  companionAgentFor,
  KNOWN_COMPANION_AGENTS,
  listCompanions,
  MANAGED_SKILLS,
  removeCompanion,
  runSkillsCli,
  SKILLS_CLI_PACKAGE,
} from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import {
  withoutRecordedSelection,
  withRecordedSelection,
  writeSkillsRecord,
} from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';
import { isRecord } from '@/lib/primitives.js';
import type { PlatformResult } from '@/types.js';

/**
 * Legacy companion cleanup for the external skills-CLI copies the CLI
 * installed before maestria packages started bundling their own skills.
 * Nothing here installs: update and uninstall remove recorded (owned) managed
 * skills after the plugin batch, then drop the platform record entry.
 * Ownership is never inferred from the filesystem: removal runs only for
 * recorded selections and only when no other observed consumer shares the
 * tool-observed path. Records persist only actual confirmed state.
 */

/** Skills in a selection this CLI version does not manage. */
const unknownSkills = (skills: readonly string[]): string[] =>
  skills.filter((skill) => !MANAGED_SKILLS.includes(skill));

/** Record read; ownership never comes from filesystem observation. */
const recordedSkills = (record: SkillsRecord | null, platformId: string): string[] | null =>
  record?.platforms[platformId]?.skills ?? null;

const observedSkillPath = async (
  runner: SkillCommandRunner,
  agent: string,
  skill: string,
): Promise<string | null> => {
  const entries = await listCompanions(runner, agent, { global: true });
  return entries.find((entry) => entry.name === skill)?.path ?? null;
};

/** Minimal shape for the shared-path guard: platform identity plus current intent. */
interface SharerScope {
  readonly id: string;
  readonly selection: { readonly skills: readonly string[] };
}

/**
 * Other owned platforms that still want one skill and are not dropping it in
 * this same run. A shared tool-observed path means preserve-and-report,
 * never delete.
 */
const stayingSharers = (
  record: SkillsRecord | null,
  effective: readonly SharerScope[],
  platformId: string,
  skill: string,
): string[] => {
  const dropping = new Set(
    effective.filter((entry) => !entry.selection.skills.includes(skill)).map((entry) => entry.id),
  );
  return Object.keys(record?.platforms ?? {}).filter(
    (otherId) =>
      otherId !== platformId &&
      (record?.platforms[otherId]?.skills ?? []).includes(skill) &&
      !dropping.has(otherId),
  );
};

/**
 * Shared-path guard with fresh reads. Staying sharers report their
 * platform ID, other known agents their agent name. An unreadable agent fails
 * closed as a sharer.
 */
const findSharingObserver = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly SharerScope[],
  platformId: string,
  skill: string,
  ownPath: string,
): Promise<string | null> => {
  const staying = stayingSharers(record, effective, platformId, skill);
  const checkedAgents = new Set<string>();
  for (const otherId of staying) {
    const otherAgent = companionAgentFor(otherId);
    if (otherAgent === null) {
      continue;
    }
    checkedAgents.add(otherAgent);
    // oxlint-disable-next-line no-await-in-loop -- sequential pre-effect checks keep failure order deterministic.
    const otherPath = await observedSkillPath(runner, otherAgent, skill);
    if (otherPath === ownPath) {
      return otherId;
    }
  }
  const ownAgent = companionAgentFor(platformId);
  const droppingAgents = new Set(
    effective
      .filter((entry) => !entry.selection.skills.includes(skill))
      .map((entry) => companionAgentFor(entry.id))
      .filter((agent): agent is string => agent !== null),
  );
  for (const otherAgent of KNOWN_COMPANION_AGENTS) {
    if (
      otherAgent === ownAgent ||
      checkedAgents.has(otherAgent) ||
      droppingAgents.has(otherAgent)
    ) {
      continue;
    }
    let otherPath: string | null;
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential pre-effect checks keep failure order deterministic.
      otherPath = await observedSkillPath(runner, otherAgent, skill);
    } catch {
      return otherAgent;
    }
    if (otherPath === ownPath) {
      return otherAgent;
    }
  }
  return null;
};

/** Remove one owned skill when unshared; otherwise report preservation. */
const removeOwnedSkillIfUnshared = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly SharerScope[],
  platformId: string,
  agent: string,
  skill: string,
  ownPath: string,
  onNote: (note: string) => void,
): Promise<void> => {
  const sharer = await findSharingObserver(runner, record, settled, platformId, skill, ownPath);
  if (sharer === null) {
    await removeCompanion(runner, { agent, skill }, { global: true });
    return;
  }
  onNote(`Skill '${skill}' left in place at ${ownPath}; still provided by '${sharer}'.`);
};

const manualRemoveCommand = (agent: string, skill: string): string =>
  `npx -y ${SKILLS_CLI_PACKAGE} remove ${skill} -a ${agent} -g -y`;

/** Remove every owned skill for one platform; a failure keeps the record for retry. */
const removeOwnedLegacySkills = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly SharerScope[],
  result: PlatformResult,
  agent: string,
  owned: readonly string[],
): Promise<{ remaining: string[] | null; result: PlatformResult }> => {
  const notes: string[] = [];
  try {
    for (const skill of owned) {
      // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
      const ownPath = await observedSkillPath(runner, agent, skill);
      if (ownPath !== null) {
        // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
        await removeOwnedSkillIfUnshared(
          runner,
          record,
          settled,
          result.id,
          agent,
          skill,
          ownPath,
          (note) => {
            notes.push(note);
          },
        );
      }
    }
  } catch (error) {
    const retry = owned.map((skill) => manualRemoveCommand(agent, skill)).join('; ');
    return {
      remaining: null,
      result: {
        ...result,
        message:
          `${result.message} Legacy skill removal failed ` +
          `(${error instanceof Error ? error.message : String(error)}). ` +
          `Retry manually: ${retry}.`,
        ok: false,
        skills: [],
      },
    };
  }
  const unrecognized = unknownSkills(recordedSkills(record, result.id) ?? []);
  const suffix = notes.length === 0 ? '' : ` ${notes.join(' ')}`;
  return {
    remaining: [...unrecognized],
    result: { ...result, message: `${result.message}${suffix}`, skills: [] },
  };
};

/**
 * Reconcile one platform after a successful plugin operation. Missing records
 * leave companions in place with a manual command (or stay silent when the
 * caller opts out of the note). Unknown skill IDs keep their history.
 * Observed but unrecorded copies are never removed.
 */
const reconcileOneLegacy = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly SharerScope[],
  result: PlatformResult,
  silentWhenUnrecorded: boolean,
): Promise<{ remaining: string[] | null; result: PlatformResult }> => {
  const agent = companionAgentFor(result.id);
  if (agent === null) {
    return { remaining: [], result: { ...result, skills: [] } };
  }
  const recorded = recordedSkills(record, result.id) ?? [];
  const owned = recorded.filter((skill) => MANAGED_SKILLS.includes(skill));
  const unrecognized = unknownSkills(recorded);
  if (record?.platforms[result.id] === undefined) {
    if (silentWhenUnrecorded) {
      return { remaining: null, result };
    }
    return {
      remaining: null,
      result: {
        ...result,
        message:
          `${result.message} No maestria skill record for '${result.id}'; ` +
          `any copy is left in place. Remove one manually only if maestria installed it: ` +
          `${MANAGED_SKILLS.map((skill) => manualRemoveCommand(agent, skill)).join('; ')}.`,
        skills: [],
      },
    };
  }
  if (owned.length === 0) {
    return { remaining: [...unrecognized], result: { ...result, skills: [] } };
  }
  return await removeOwnedLegacySkills(runner, record, settled, result, agent, owned);
};

export interface LegacyCleanupOptions {
  /**
   * When true, platforms without a record entry keep their result untouched
   * and silent (no observation, no note). The update path uses this so fresh
   * installs without legacy records see no cleanup noise.
   */
  readonly silentWhenUnrecorded: boolean;
}

/**
 * Remove legacy managed companions after successful plugin operations. Only
 * recorded (owned) known skills are removed, each only when no other observed
 * consumer shares the tool-observed path. Unrecorded copies are never
 * removed.
 */
export const removeLegacyCompanions = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  results: readonly PlatformResult[],
  options?: LegacyCleanupOptions,
): Promise<{ results: PlatformResult[] }> => {
  const settled = results
    .filter((result) => result.ok)
    .map((result) => ({ id: result.id, selection: { changed: false, skills: [] as string[] } }));
  let next = record;
  const merged: PlatformResult[] = [];
  for (const result of results) {
    if (!result.ok) {
      merged.push(result);
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
    const reconciled = await reconcileOneLegacy(
      runner,
      next,
      settled,
      result,
      options?.silentWhenUnrecorded ?? false,
    );
    const { remaining } = reconciled;
    if (remaining !== null) {
      if (remaining.length === 0) {
        next = withoutRecordedSelection(next, result.id) ?? next;
      } else {
        const assets = next?.platforms[result.id]?.skillAssets ?? {};
        const kept = Object.fromEntries(
          Object.entries(assets).filter(([skill]) => remaining.includes(skill)),
        );
        next = withRecordedSelection(next, result.id, remaining, kept);
      }
    }
    merged.push(reconciled.result);
  }
  if (next !== record && next !== null) {
    await writeSkillsRecord(next);
  }
  return { results: merged };
};

export const defaultSkillRunner: SkillCommandRunner = async (args, options) =>
  await runSkillsCli(args, options);

const REMOVED_FLAG_KEYS: readonly string[] = [
  'skills',
  'exclude-skills',
  'excludeSkills',
  'maestria-skills',
  'maestriaSkills',
];

const removedFlagDisplay = (key: string): string => {
  if (key === 'excludeSkills') {
    return '--exclude-skills';
  }
  if (key === 'maestriaSkills') {
    return '--maestria-skills';
  }
  return `--${key}`;
};

/**
 * Reject the retired companion-skill flags before any effect. citty passes
 * unknown flags through in the args object (strict parsing is off), so a
 * removed `--skills` still arrives here and must fail loud with guidance
 * instead of being silently ignored.
 */
export const assertNoRemovedSkillFlags = (args: unknown): void => {
  if (!isRecord(args)) {
    return;
  }
  const found = REMOVED_FLAG_KEYS.find((key) => args[key] !== undefined);
  if (found === undefined) {
    return;
  }
  const flag = removedFlagDisplay(found);
  throw new CliError(
    `the ${flag} flag was removed: maestria packages now bundle their skills, ` +
      `so there is nothing extra to install. Re-run without the flag.`,
    1,
  );
};
