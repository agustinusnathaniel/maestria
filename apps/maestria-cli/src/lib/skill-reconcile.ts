import type { Effect } from 'effect';

import { batchCommandResult, runBatchSelected } from '@/lib/batch-command.js';
import { CliError } from '@/lib/command-result.js';
import type { CommandResult } from '@/lib/command-result.js';
import {
  addCompanion,
  COMPANION_SKILL,
  companionAgentFor,
  isCompanionSupported,
  KNOWN_COMPANION_AGENTS,
  listCompanions,
  removeCompanion,
  runSkillsCli,
  SKILLS_CLI_PACKAGE,
  SKILLS_SOURCE,
} from '@/lib/skill-companion.js';
import type { SkillCommandRunner } from '@/lib/skill-companion.js';
import {
  hasSkillFlags,
  persistSuccessfulSelections,
  resolveSkillSelection,
  withoutRecordedSelection,
  writeSkillsRecord,
} from '@/lib/skills.js';
import type { ResolvedSkillSelection, SkillsRecord } from '@/lib/skills.js';
import { isRecord } from '@/lib/primitives.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import { reviewSkillSelections } from '@/lib/skill-prompts.js';
import type { PlatformResult } from '@/types.js';

/**
 * Skill reconciliation between Maestria platform operations and the external
 * skills-CLI companion. Plugin lifecycle (install/update/uninstall) keeps its
 * existing behavior with no payload filtering and no forced reinstalls;
 * companion add/remove is scoped to one known managed skill, source, and
 * native target. Ownership is never inferred from the filesystem: before any
 * mutation the CLI lists the native target's tool-observed inventory and
 * compares it against its own record of owned operations. Records persist
 * only after both sides actually succeed.
 */

/** Remote default resolves only after this feature merges; tests inject a local copy. */
export const resolveSkillsSource = (): string => {
  const override = process.env.MAESTRIA_SKILLS_SOURCE?.trim();
  return override !== undefined && override !== '' ? override : SKILLS_SOURCE;
};

export interface EffectiveSkillTarget {
  readonly id: string;
  readonly label?: string;
  readonly observed?: { path?: string; source?: string };
  readonly selection: ResolvedSkillSelection;
}

const recordedFor = (record: SkillsRecord | null, platformId: string): string[] | null =>
  record?.platforms[platformId]?.skills ?? null;

const isOwned = (record: SkillsRecord | null, platformId: string): boolean =>
  (recordedFor(record, platformId) ?? []).includes(COMPANION_SKILL);

/** Unknown hosts degrade to an empty selection with the core fallback. */
export const resolveEffectiveSkills = (
  targets: readonly { id: string; label?: string }[],
  args: { excludeSkills?: string; skills?: string },
  record: SkillsRecord | null,
): EffectiveSkillTarget[] =>
  targets.map((target) => {
    const selection = resolveSkillSelection(target.id, args, record);
    if (isCompanionSupported(target.id)) {
      return { ...target, selection };
    }
    if (hasSkillFlags(args) && selection.skills.length > 0) {
      throw new CliError(
        `Skill '${selection.skills[0]}' has no companion target for platform '${target.id}' ` +
          `(the skills CLI registry lists no ${target.id} agent, and no host discovery of ` +
          `the universal target path is verified for it). ` +
          `Core keeps its reviewable-body fallback; omit --skills for this platform.`,
        1,
      );
    }
    const recorded = recordedFor(record, target.id);
    return {
      ...target,
      selection: {
        changed: recorded === null || recorded.length > 0,
        skills: [],
      },
    };
  });

/** Tool-observed native path of our skill for one agent, or null when absent. */
const observedSkillPath = async (
  runner: SkillCommandRunner,
  agent: string,
): Promise<string | null> => {
  const entries = await listCompanions(runner, agent, { global: true });
  return entries.find((entry) => entry.name === COMPANION_SKILL)?.path ?? null;
};

/** Explicit `--skills` never authorizes adopting an independent copy. */
export const isSharedRecordedAsset = (
  record: SkillsRecord | null,
  platformId: string,
  observed: string,
  source: string,
): boolean =>
  Object.entries(record?.platforms ?? {}).some(
    ([otherId, entry]) =>
      otherId !== platformId &&
      entry.skills.includes(COMPANION_SKILL) &&
      entry.source === source &&
      entry.path === observed,
  );

/** Throws before any host mutation; callers must not catch it as a per-platform note. */
export const preflightCompanionOwnership = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
  source: string = resolveSkillsSource(),
): Promise<void> => {
  for (const target of effective) {
    if (!target.selection.skills.includes(COMPANION_SKILL)) {
      continue;
    }
    const agent = companionAgentFor(target.id);
    if (agent === null || isOwned(record, target.id)) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- sequential pre-effect checks keep failure order deterministic.
    const observed = await observedSkillPath(runner, agent);
    if (observed === null || isSharedRecordedAsset(record, target.id, observed, source)) {
      continue;
    }
    throw new CliError(
      `Existing unmanaged skill '${COMPANION_SKILL}' for agent '${agent}' at ${observed} ` +
        `with no Maestria selection record. Re-run with --exclude-skills ${COMPANION_SKILL} ` +
        `to leave it alone, or remove it manually first. No changes were made.`,
      1,
    );
  }
};

export interface CompanionOutcome {
  readonly notes: Map<string, string>;
  readonly observed: Map<string, { path?: string; source?: string }>;
  readonly ok: Map<string, boolean>;
}

/**
 * Other owned platforms that still want the skill and are not dropping it in
 * this same run. Their tool-observed paths decide whether a scoped removal
 * is safe: the skills CLI deletes a shared canonical directory even while
 * another agent still references it (verified), so a shared path means
 * preserve-and-report, never delete.
 */
/** Platform IDs dropping the companion skill in this same run. */
const droppingIds = (effective: readonly EffectiveSkillTarget[]): Set<string> =>
  new Set(
    effective
      .filter((entry) => !entry.selection.skills.includes(COMPANION_SKILL))
      .map((entry) => entry.id),
  );

const stayingSharers = (
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
  platformId: string,
): string[] => {
  const dropping = droppingIds(effective);
  return Object.keys(record?.platforms ?? {}).filter(
    (otherId) =>
      otherId !== platformId &&
      (record?.platforms[otherId]?.skills ?? []).includes(COMPANION_SKILL) &&
      !dropping.has(otherId),
  );
};

const removalSharesObservedPath = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
  platformId: string,
  ownPath: string,
): Promise<string | null> => {
  const staying = stayingSharers(record, effective, platformId);
  const checkedAgents = new Set<string>();
  for (const otherId of staying) {
    const otherAgent = companionAgentFor(otherId);
    if (otherAgent === null) {
      continue;
    }
    checkedAgents.add(otherAgent);
    // oxlint-disable-next-line no-await-in-loop -- sequential pre-effect checks keep failure order deterministic.
    const otherPath = await observedSkillPath(runner, otherAgent);
    if (otherPath === ownPath) {
      return otherId;
    }
  }
  const ownAgent = companionAgentFor(platformId);
  const droppingAgents = new Set(
    [...droppingIds(effective)]
      .map((id) => companionAgentFor(id))
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
      otherPath = await observedSkillPath(runner, otherAgent);
    } catch {
      return otherAgent;
    }
    if (otherPath === ownPath) {
      return otherAgent;
    }
  }
  return null;
};

/** Single removal guard for the deselect and uninstall paths. */
const removeIfUnshared = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly EffectiveSkillTarget[],
  platformId: string,
  agent: string,
  ownPath: string,
): Promise<string | null> => {
  const sharer = await removalSharesObservedPath(runner, record, settled, platformId, ownPath);
  if (sharer === null) {
    await removeCompanion(runner, { agent, skill: COMPANION_SKILL }, { global: true });
  }
  return sharer;
};

const sharedPreservedNote = (ownPath: string, sharer: string): string =>
  `Skill '${COMPANION_SKILL}' left in place at ${ownPath}; still provided by '${sharer}'.`;

/** Never uses a broad `skills update`; errors propagate per platform. */
const reconcileSelectedTarget = async (
  runner: SkillCommandRunner,
  target: EffectiveSkillTarget,
  agent: string,
  source: string,
  outcome: CompanionOutcome,
): Promise<void> => {
  const installed = await addCompanion(
    runner,
    { agent, skill: COMPANION_SKILL, source },
    { global: true },
  );
  outcome.observed.set(target.id, { path: installed.path, source });
  outcome.ok.set(target.id, true);
};

const reconcileDeselectedTarget = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly EffectiveSkillTarget[],
  target: EffectiveSkillTarget,
  agent: string,
  reportExcludedPresence: boolean,
  outcome: CompanionOutcome,
): Promise<void> => {
  if (!isOwned(record, target.id)) {
    if (reportExcludedPresence) {
      const present = await observedSkillPath(runner, agent);
      if (present !== null) {
        outcome.notes.set(
          target.id,
          `Skill '${COMPANION_SKILL}' at ${present} left in place (independently installed or previously unmanaged).`,
        );
      }
    }
    outcome.ok.set(target.id, true);
    return;
  }
  const ownPath = await observedSkillPath(runner, agent);
  if (ownPath === null) {
    outcome.notes.set(
      target.id,
      `Skill record for '${target.id}' cleaned up; no '${COMPANION_SKILL}' copy was listed for agent '${agent}'.`,
    );
    outcome.ok.set(target.id, true);
    return;
  }
  const sharer = await removeIfUnshared(runner, record, settled, target.id, agent, ownPath);
  if (sharer !== null) {
    outcome.notes.set(target.id, sharedPreservedNote(ownPath, sharer));
  }
  outcome.ok.set(target.id, true);
};

/**
 * Reconcile the companion after the plugin operation. Skipped for platforms
 * whose plugin step failed. See the per-target helpers for add/remove
 * semantics; records persist only after both sides actually succeed.
 */
export const reconcileCompanions = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
  pluginOk: ReadonlyMap<string, boolean>,
  source: string = resolveSkillsSource(),
  reportExcludedPresence = false,
): Promise<CompanionOutcome> => {
  const outcome: CompanionOutcome = { notes: new Map(), observed: new Map(), ok: new Map() };
  const settled = effective.filter((entry) => pluginOk.get(entry.id) === true);
  for (const target of effective) {
    if (pluginOk.get(target.id) !== true) {
      outcome.ok.set(target.id, false);
      continue;
    }
    const agent = companionAgentFor(target.id);
    if (agent === null) {
      outcome.ok.set(target.id, true);
      outcome.notes.set(
        target.id,
        `Skill companion unavailable for '${target.id}' (no skills-CLI target and no ` +
          `verified host discovery of the universal path); ` +
          `core reviewable-body fallback applies. Manage the skill manually: ` +
          `npx -y skills@1.7.0 add ${source} --skill ${COMPANION_SKILL} -g -y.`,
      );
      continue;
    }
    try {
      const pending = target.selection.skills.includes(COMPANION_SKILL)
        ? reconcileSelectedTarget(runner, target, agent, source, outcome)
        : reconcileDeselectedTarget(
            runner,
            record,
            settled,
            target,
            agent,
            reportExcludedPresence,
            outcome,
          );
      // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
      await pending;
    } catch (error) {
      outcome.ok.set(target.id, false);
      outcome.notes.set(target.id, error instanceof Error ? error.message : String(error));
    }
  }
  return outcome;
};

/** Merge companion outcomes into batch results; JSON stays valid (fields, not text). */
export const applyCompanionOutcomes = (
  results: readonly PlatformResult[],
  effective: readonly EffectiveSkillTarget[],
  outcome: CompanionOutcome,
): PlatformResult[] => {
  const byId = new Map(effective.map((entry) => [entry.id, entry]));
  return results.map((result) => {
    const entry = byId.get(result.id);
    const companionOk = outcome.ok.get(result.id) ?? true;
    const note = outcome.notes.get(result.id);
    const ok = result.ok && companionOk;
    let { message } = result;
    if (note === undefined) {
      if (!companionOk) {
        message = result.ok
          ? `${message} Plugin operation succeeded but skill companion failed; selection record unchanged.`
          : `${message} Plugin operation failed; skill companion not reconciled; selection record unchanged.`;
      }
    } else if (!result.ok) {
      message = `${message} Skill companion not reconciled (${note}); selection record unchanged.`;
    } else if (companionOk) {
      message = `${message} ${note}`;
    } else {
      message = `${message} Plugin operation succeeded but skill companion failed (${note}); selection record unchanged.`;
    }
    const observed = outcome.observed.get(result.id);
    return {
      ...result,
      message,
      ok,
      ...(entry === undefined
        ? {}
        : {
            skills: [...entry.selection.skills],
            ...(observed === undefined ? {} : { observed }),
          }),
    };
  });
};

/** Attach tool-observed source/path to reviewed targets for truthful persistence. */
export const attachCompanionObserved = (
  effective: readonly EffectiveSkillTarget[],
  outcome: CompanionOutcome,
): EffectiveSkillTarget[] =>
  effective.map((entry) => {
    const found = outcome.observed.get(entry.id);
    return found === undefined ? entry : { ...entry, observed: found };
  });

const manualRemoveCommand = (agent: string): string =>
  `npx -y ${SKILLS_CLI_PACKAGE} remove ${COMPANION_SKILL} -a ${agent} -g -y`;

const reconcileOneUninstall = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly { id: string; selection: { changed: boolean; skills: string[] } }[],
  result: PlatformResult,
): Promise<{ drop: boolean; result: PlatformResult }> => {
  const agent = companionAgentFor(result.id);
  if (agent === null) {
    return { drop: false, result: { ...result, skills: [] } };
  }
  if (!isOwned(record, result.id)) {
    if (record?.platforms[result.id] !== undefined) {
      return { drop: false, result: { ...result, skills: [] } };
    }
    return {
      drop: false,
      result: {
        ...result,
        message:
          `${result.message} No Maestria skill record for '${result.id}'; ` +
          `companion left in place. Remove it manually if ours: ${manualRemoveCommand(agent)}.`,
        skills: [],
      },
    };
  }
  try {
    const ownPath = await observedSkillPath(runner, agent);
    if (ownPath === null) {
      return { drop: true, result: { ...result, skills: [] } };
    }
    const sharer = await removeIfUnshared(runner, record, settled, result.id, agent, ownPath);
    if (sharer !== null) {
      return {
        drop: true,
        result: {
          ...result,
          message: `${result.message} ${sharedPreservedNote(ownPath, sharer)}`,
          skills: [],
        },
      };
    }
    return { drop: true, result: { ...result, skills: [] } };
  } catch (error) {
    return {
      drop: false,
      result: {
        ...result,
        message:
          `Plugin uninstalled but companion removal failed ` +
          `(${error instanceof Error ? error.message : String(error)}). ` +
          `Retry manually: ${manualRemoveCommand(agent)}.`,
        ok: false,
        skills: [],
      },
    };
  }
};

export const reconcileUninstallCompanions = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  results: readonly PlatformResult[],
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
    const reconciled = await reconcileOneUninstall(runner, record, settled, result);
    if (reconciled.drop) {
      next = withoutRecordedSelection(next, result.id) ?? next;
    }
    merged.push(reconciled.result);
  }
  if (next !== record && next !== null) {
    await writeSkillsRecord(next);
  }
  return { results: merged };
};

/** Default production runner (tests inject a fake). */
export const defaultSkillRunner: SkillCommandRunner = async (args, options) =>
  await runSkillsCli(args, options);

export interface RawSkillArgs {
  readonly excludeSkills?: string;
  readonly skills?: string;
  readonly yes?: boolean;
}

/**
 * Accept both camelCase (direct handler calls, tests) and kebab-case (citty
 * parses `--exclude-skills` under its defined key) spellings.
 */
export const normalizeSkillArgs = <T extends RawSkillArgs>(args: T): T => {
  const kebab = isRecord(args) ? args['exclude-skills'] : undefined;
  return {
    ...args,
    excludeSkills: args.excludeSkills ?? (typeof kebab === 'string' ? kebab : undefined),
  };
};

/**
 * Interactive skill review for supported targets only. Hosts with no
 * companion target keep their degraded empty selection and are never
 * prompted for a skill they cannot receive.
 */
export const reviewSupportedSkills = async (
  effective: readonly EffectiveSkillTarget[],
  action: 'Install' | 'Update',
  args: { yes?: boolean } & { excludeSkills?: string; skills?: string },
): Promise<EffectiveSkillTarget[]> => {
  const supported = effective.filter((entry) => isCompanionSupported(entry.id));
  const reviewed = await reviewSkillSelections(supported, action, args);
  const byId = new Map(reviewed.map((entry) => [entry.id, entry]));
  return effective.map((entry) => byId.get(entry.id) ?? entry);
};

export interface SkillBatchArgs {
  readonly compact?: boolean;
  readonly excludeSkills?: string;
  readonly json?: boolean;
  readonly skills?: string;
  readonly yes?: boolean;
}

/**
 * Shared install/update tail: review selections, preflight ownership, run the
 * plugin batch, reconcile companions, persist successful selections, render.
 * Uninstall keeps its own tail (companion removal without re-add).
 */
export const runSkillBatch = async (
  targets: readonly { id: string; label?: string }[],
  record: SkillsRecord | null,
  action: 'Install' | 'Update',
  args: SkillBatchArgs,
  isQuiet: boolean,
  operation: (platform: PlatformHandler, quiet: boolean) => Effect.Effect<PlatformResult>,
): Promise<CommandResult> => {
  const resolved = resolveEffectiveSkills(targets, args, record);
  const reviewed = await reviewSupportedSkills(resolved, action, args);
  await preflightCompanionOwnership(defaultSkillRunner, record, reviewed);
  const results = await runBatchSelected(targets, isQuiet, operation);
  const pluginOk = new Map(results.map((result) => [result.id, result.ok]));
  const outcome = await reconcileCompanions(
    defaultSkillRunner,
    record,
    reviewed,
    pluginOk,
    resolveSkillsSource(),
    hasSkillFlags(args),
  );
  const combined = applyCompanionOutcomes(results, reviewed, outcome);
  await persistSuccessfulSelections(
    record,
    attachCompanionObserved(reviewed, outcome),
    combined.map((result) => ({ id: result.id, ok: result.ok })),
    false,
  );
  return batchCommandResult(combined, args);
};
