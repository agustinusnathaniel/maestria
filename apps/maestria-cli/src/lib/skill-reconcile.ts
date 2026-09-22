// oxlint-disable max-lines -- skill-reconcile is the single companion reconciler for install, update, and uninstall sharing one ownership preflight, one shared-path guard, and one outcome merge. Splitting per flow or per skill would duplicate the guard logic that must stay single so removing one skill never disturbs another.
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
  MANAGED_SKILLS,
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
  withRecordedSelection,
  writeSkillsRecord,
} from '@/lib/skills.js';
import type {
  ResolvedSkillSelection,
  SkillAsset,
  SkillResolutionContext,
  SkillsRecord,
} from '@/lib/skills.js';
import { isRecord } from '@/lib/primitives.js';
import type { PlatformHandler } from '@/lib/platforms.js';
import { reviewSkillSelections } from '@/lib/skill-prompts.js';
import type { PlatformResult } from '@/types.js';

/**
 * Skill reconciliation between Maestria platform operations and the external
 * skills-CLI companions. Plugin lifecycle (install/update/uninstall) keeps
 * its existing behavior with no payload filtering and no forced reinstalls;
 * companion add/remove runs per known managed skill, each scoped to its own
 * source, skill name, and native target. Ownership is never inferred from the
 * filesystem: before any mutation the CLI lists the native target's
 * tool-observed inventory and compares it against its own per-skill record of
 * owned operations. Records persist only actual confirmed state: a failed
 * skill is never recorded as installed, while a successfully installed
 * sibling is kept recoverably.
 */

/** Remote default resolves only after this feature merges; tests inject a local copy. */
export const resolveSkillsSource = (): string => {
  const override = process.env.MAESTRIA_SKILLS_SOURCE?.trim();
  return override !== undefined && override !== '' ? override : SKILLS_SOURCE;
};

export interface EffectiveSkillTarget {
  readonly id: string;
  readonly label?: string;
  /** Per-skill tool-observed assets, attached after reconcile. */
  readonly observed?: Record<string, SkillAsset>;
  /** Skills actually confirmed, attached after reconcile (defaults to intent). */
  readonly actualSkills?: string[];
  readonly selection: ResolvedSkillSelection;
}

const recordedFor = (record: SkillsRecord | null, platformId: string): string[] | null =>
  record?.platforms[platformId]?.skills ?? null;

const isOwned = (record: SkillsRecord | null, platformId: string, skill: string): boolean =>
  (recordedFor(record, platformId) ?? []).includes(skill);

/** Skills in a selection this CLI version does not manage: preserved, reported, never run. */
const unknownSkills = (skills: readonly string[]): string[] =>
  skills.filter((skill) => !MANAGED_SKILLS.includes(skill));

/**
 * Resolve per-platform selections, degrading honestly on hosts with no
 * companion target (unknown IDs only; all nine known platforms resolve):
 * an explicit skill request fails loud before effects, while a default run
 * records an empty selection and keeps the core sensible-body fallback
 * instead of faking a full feature. Pass `updateBootstrap` on the update
 * path so legacy installs without a record infer only the prior PR skill.
 */
export const resolveEffectiveSkills = (
  targets: readonly { id: string; label?: string }[],
  args: { excludeSkills?: string; skills?: string },
  record: SkillsRecord | null,
  context: SkillResolutionContext = {},
): EffectiveSkillTarget[] =>
  targets.map((target) => {
    const selection = resolveSkillSelection(target.id, args, record, context);
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

/** Tool-observed native path of one skill for one agent, or null when absent. */
const observedSkillPath = async (
  runner: SkillCommandRunner,
  agent: string,
  skill: string,
): Promise<string | null> => {
  const entries = await listCompanions(runner, agent, { global: true });
  return entries.find((entry) => entry.name === skill)?.path ?? null;
};

/** Explicit `--skills` never authorizes adopting an independent copy. */
export const isSharedRecordedAsset = (
  record: SkillsRecord | null,
  platformId: string,
  skill: string,
  observed: string,
  source: string,
): boolean =>
  Object.entries(record?.platforms ?? {}).some(
    ([otherId, entry]) =>
      otherId !== platformId &&
      entry.skills.includes(skill) &&
      entry.skillAssets?.[skill]?.source === source &&
      entry.skillAssets?.[skill]?.path === observed,
  );

/**
 * Ownership preflight, run BEFORE any external effect (after flag validation
 * and interactive confirmation). Each selected known skill's native target is
 * listed and compared against our own record: a present copy with no record
 * is unmanaged and aborts with the exclude-or-remove guidance (an explicit
 * `--skills` selection is not authorization to adopt it), unless the observed
 * path matches a recorded Maestria asset for another platform from the same
 * source, in which case re-adding is a safe idempotent share. Exclusions
 * never delete. Unknown skill IDs are never listed or adopted here. Throws
 * before any host mutation; callers must not catch it as a per-platform note.
 */
export const preflightCompanionOwnership = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
  source: string = resolveSkillsSource(),
): Promise<void> => {
  for (const target of effective) {
    const selected = target.selection.skills.filter((skill) => MANAGED_SKILLS.includes(skill));
    for (const skill of selected) {
      const agent = companionAgentFor(target.id);
      if (agent === null || isOwned(record, target.id, skill)) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop -- sequential pre-effect checks keep failure order deterministic.
      const observed = await observedSkillPath(runner, agent, skill);
      if (observed === null || isSharedRecordedAsset(record, target.id, skill, observed, source)) {
        continue;
      }
      throw new CliError(
        `Existing unmanaged skill '${skill}' for agent '${agent}' at ${observed} ` +
          `with no Maestria selection record. Re-run with --exclude-skills ${skill} ` +
          `to leave it alone, or remove it manually first. No changes were made.`,
        1,
      );
    }
  }
};

export interface CompanionOutcome {
  readonly notes: Map<string, string>;
  /** Per-platform, per-skill tool-observed assets for actually installed skills. */
  readonly observed: Map<string, Record<string, SkillAsset>>;
  /**
   * Per-platform confirmed skill lists: unknown IDs preserved, failed skills
   * excluded. A failed skill is never recorded as installed; a successfully
   * installed sibling stays recoverably recorded.
   */
  readonly actual: Map<string, string[]>;
  readonly ok: Map<string, boolean>;
}

const appendNote = (outcome: CompanionOutcome, id: string, note: string): void => {
  const prior = outcome.notes.get(id);
  outcome.notes.set(id, prior === undefined ? note : `${prior} ${note}`);
};

/**
 * Other owned platforms that still want one skill and are not dropping it in
 * this same run. Their tool-observed paths decide whether a scoped removal
 * is safe: the skills CLI deletes a shared canonical directory even while
 * another agent still references it (verified), so a shared path means
 * preserve-and-report, never delete.
 */
const stayingSharers = (
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
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

const removalSharesObservedPath = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
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

/**
 * Reconcile one selected skill: idempotent re-add of the known managed
 * triple (never a broad `skills update`). Errors propagate to the caller,
 * which records them per platform without failing siblings or skills.
 */
const reconcileSelectedTarget = async (
  runner: SkillCommandRunner,
  target: EffectiveSkillTarget,
  agent: string,
  skill: string,
  source: string,
  outcome: CompanionOutcome,
): Promise<void> => {
  const installed = await addCompanion(runner, { agent, skill, source }, { global: true });
  const assets = outcome.observed.get(target.id) ?? {};
  outcome.observed.set(target.id, { ...assets, [skill]: { path: installed.path, source } });
};

/**
 * Reconcile one deselected skill: removal runs only for recorded (owned)
 * selections and only when no other observed consumer shares the
 * tool-observed path (owned record or independent agent inventory);
 * otherwise the copy is preserved with a note naming the sharer.
 * Unmanaged copies are left alone, with a presence note when the caller
 * explicitly reports exclusions. Removing one skill never touches another.
 */
const reconcileDeselectedTarget = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly EffectiveSkillTarget[],
  target: EffectiveSkillTarget,
  agent: string,
  skill: string,
  reportExcludedPresence: boolean,
  outcome: CompanionOutcome,
): Promise<void> => {
  if (!isOwned(record, target.id, skill)) {
    if (reportExcludedPresence) {
      const present = await observedSkillPath(runner, agent, skill);
      if (present !== null) {
        appendNote(
          outcome,
          target.id,
          `Skill '${skill}' at ${present} left in place (independently installed or previously unmanaged).`,
        );
      }
    }
    return;
  }
  const ownPath = await observedSkillPath(runner, agent, skill);
  if (ownPath === null) {
    appendNote(
      outcome,
      target.id,
      `Skill record for '${target.id}' cleaned up; no '${skill}' copy was listed for agent '${agent}'.`,
    );
    return;
  }
  const sharer = await removalSharesObservedPath(
    runner,
    record,
    settled,
    target.id,
    skill,
    ownPath,
  );
  if (sharer === null) {
    await removeCompanion(runner, { agent, skill }, { global: true });
  } else {
    appendNote(
      outcome,
      target.id,
      `Skill '${skill}' left in place at ${ownPath}; still provided by '${sharer}'.`,
    );
  }
};

/**
 * Reconcile every managed skill for one target independently: one skill's
 * failure never blocks its sibling, and the confirmed actuals exclude failed
 * skills so the record stays truthful. Unknown skill IDs are preserved with
 * a note and never operated on.
 */
const reconcileOneTarget = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly EffectiveSkillTarget[],
  target: EffectiveSkillTarget,
  agent: string,
  source: string,
  reportExcludedPresence: boolean,
  outcome: CompanionOutcome,
): Promise<void> => {
  const failed = new Set<string>();
  const unrecognized = unknownSkills(target.selection.skills);
  if (unrecognized.length > 0) {
    appendNote(
      outcome,
      target.id,
      `Skill '${unrecognized[0]}' is not managed by this CLI version; left in place.`,
    );
  }
  for (const skill of MANAGED_SKILLS) {
    const pending = target.selection.skills.includes(skill)
      ? reconcileSelectedTarget(runner, target, agent, skill, source, outcome)
      : reconcileDeselectedTarget(
          runner,
          record,
          settled,
          target,
          agent,
          skill,
          reportExcludedPresence,
          outcome,
        );
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
      await pending;
    } catch (error) {
      failed.add(skill);
      appendNote(outcome, target.id, error instanceof Error ? error.message : String(error));
    }
  }
  outcome.ok.set(target.id, failed.size === 0);
  outcome.actual.set(
    target.id,
    target.selection.skills.filter((skill) => !failed.has(skill)),
  );
};

/**
 * Reconcile the companions after the plugin operation. Skipped for platforms
 * whose plugin step failed. See reconcileOneTarget for per-skill semantics;
 * records persist only actual confirmed state.
 */
export const reconcileCompanions = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  effective: readonly EffectiveSkillTarget[],
  pluginOk: ReadonlyMap<string, boolean>,
  source: string = resolveSkillsSource(),
  reportExcludedPresence = false,
): Promise<CompanionOutcome> => {
  const outcome: CompanionOutcome = {
    actual: new Map(),
    notes: new Map(),
    observed: new Map(),
    ok: new Map(),
  };
  const settled = effective.filter((entry) => pluginOk.get(entry.id) === true);
  for (const target of effective) {
    if (pluginOk.get(target.id) !== true) {
      outcome.ok.set(target.id, false);
      continue;
    }
    const agent = companionAgentFor(target.id);
    if (agent === null) {
      outcome.ok.set(target.id, true);
      outcome.actual.set(target.id, []);
      appendNote(
        outcome,
        target.id,
        `Skill companion unavailable for '${target.id}' (no skills-CLI target and no ` +
          `verified host discovery of the universal path); ` +
          `core reviewable-body fallback applies. Manage skills manually: ` +
          `npx -y skills@1.7.0 add ${source} --skill <skill> -g -y.`,
      );
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
    await reconcileOneTarget(
      runner,
      record,
      settled,
      target,
      agent,
      source,
      reportExcludedPresence,
      outcome,
    );
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
    const actual = outcome.actual.get(result.id);
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
      const intent = entry === undefined ? '' : entry.selection.skills.join(',');
      message =
        `${message} Plugin operation succeeded but skill companion failed (${note}); ` +
        `only confirmed skills were recorded${
          intent === '' ? '.' : `. Retry with --skills ${intent}.`
        }`;
    }
    const observed = outcome.observed.get(result.id);
    return {
      ...result,
      message,
      ok,
      ...(entry === undefined
        ? {}
        : {
            // Report actual confirmed skills, never intent as fact: a failed
            // skill is excluded here and from the persisted record.
            skills: actual ?? [...entry.selection.skills],
            ...(observed === undefined ? {} : { observed }),
          }),
    };
  });
};

/** Attach tool-observed per-skill assets and confirmed skills for truthful persistence. */
export const attachCompanionObserved = (
  effective: readonly EffectiveSkillTarget[],
  outcome: CompanionOutcome,
): EffectiveSkillTarget[] =>
  effective.map((entry) => {
    const found = outcome.observed.get(entry.id);
    const actual = outcome.actual.get(entry.id);
    if (found === undefined && actual === undefined) {
      return entry;
    }
    return {
      ...entry,
      ...(actual === undefined ? {} : { actualSkills: [...actual] }),
      ...(found === undefined ? {} : { observed: { ...found } }),
    };
  });

const manualRemoveCommand = (agent: string, skill: string): string =>
  `npx -y ${SKILLS_CLI_PACKAGE} remove ${skill} -a ${agent} -g -y`;

/**
 * Remove one owned skill after a successful plugin uninstall. Returns
 * whether the skill is fully reconciled plus the note for the message.
 * Shared canonical copies still observed for another consumer are preserved
 * with a naming note. Removing one skill never touches another.
 */
const reconcileOneUninstallSkill = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly { id: string; selection: { changed: boolean; skills: string[] } }[],
  platformId: string,
  agent: string,
  skill: string,
): Promise<{ done: boolean; note?: string }> => {
  const ownPath = await observedSkillPath(runner, agent, skill);
  if (ownPath === null) {
    return { done: true };
  }
  const sharer = await removalSharesObservedPath(
    runner,
    record,
    settled,
    platformId,
    skill,
    ownPath,
  );
  if (sharer !== null) {
    return {
      done: true,
      note: `Skill '${skill}' left in place at ${ownPath}; still provided by '${sharer}'.`,
    };
  }
  await removeCompanion(runner, { agent, skill }, { global: true });
  return { done: true };
};

/**
 * Remove every owned skill for one uninstall; a failure keeps the record for
 * retry. Declared before its caller to satisfy use-before-define.
 */
const removeOwnedUninstallSkills = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly { id: string; selection: { changed: boolean; skills: string[] } }[],
  result: PlatformResult,
  agent: string,
  owned: readonly string[],
): Promise<{ remaining: string[] | null; result: PlatformResult }> => {
  const notes: string[] = [];
  try {
    for (const skill of owned) {
      // oxlint-disable-next-line no-await-in-loop -- sequential host mutations keep a deterministic order.
      const reconciled = await reconcileOneUninstallSkill(
        runner,
        record,
        settled,
        result.id,
        agent,
        skill,
      );
      if (reconciled.note !== undefined) {
        notes.push(reconciled.note);
      }
    }
  } catch (error) {
    const retry = owned.map((skill) => manualRemoveCommand(agent, skill)).join('; ');
    return {
      remaining: null,
      result: {
        ...result,
        message:
          `Plugin uninstalled but companion removal failed ` +
          `(${error instanceof Error ? error.message : String(error)}). ` +
          `Retry manually: ${retry}.`,
        ok: false,
        skills: [],
      },
    };
  }
  const unrecognized = unknownSkills(recordedFor(record, result.id) ?? []);
  const suffix = notes.length === 0 ? '' : ` ${notes.join(' ')}`;
  return {
    remaining: [...unrecognized],
    result: { ...result, message: `${result.message}${suffix}`, skills: [] },
  };
};

/**
 * Reconcile one uninstalled platform. Returns the merged result plus the
 * confirmed remaining skills (only when both sides succeeded may the record
 * entry drop or shrink). Missing records leave companions in place with a
 * manual command. Unknown skill IDs are never operated on and keep their
 * history.
 */
const reconcileOneUninstall = async (
  runner: SkillCommandRunner,
  record: SkillsRecord | null,
  settled: readonly { id: string; selection: { changed: boolean; skills: string[] } }[],
  result: PlatformResult,
): Promise<{ remaining: string[] | null; result: PlatformResult }> => {
  const agent = companionAgentFor(result.id);
  if (agent === null) {
    return { remaining: [], result: { ...result, skills: [] } };
  }
  const recorded = recordedFor(record, result.id) ?? [];
  const owned = recorded.filter((skill) => MANAGED_SKILLS.includes(skill));
  const unrecognized = unknownSkills(recorded);
  if (record?.platforms[result.id] === undefined) {
    return {
      remaining: null,
      result: {
        ...result,
        message:
          `${result.message} No Maestria skill record for '${result.id}'; ` +
          `companion left in place. Remove it manually if ours: ${manualRemoveCommand(agent, COMPANION_SKILL)}.`,
        skills: [],
      },
    };
  }
  if (owned.length === 0) {
    return { remaining: [...unrecognized], result: { ...result, skills: [] } };
  }
  return await removeOwnedUninstallSkills(runner, record, settled, result, agent, owned);
};

/** Assets for skills still kept, so unknown-ID history survives entry shrink. */
const keepAssetsFor = (
  record: SkillsRecord | null,
  platformId: string,
  remaining: readonly string[],
): Record<string, SkillAsset> => {
  const assets = record?.platforms[platformId]?.skillAssets ?? {};
  return Object.fromEntries(Object.entries(assets).filter(([skill]) => remaining.includes(skill)));
};

/**
 * Remove managed companions after successful plugin uninstalls. Only
 * recorded (owned) known skills are removed, each only when no other
 * observed consumer shares the tool-observed path. Record entries drop only
 * when both sides succeeded; unknown skill IDs keep their history instead of
 * being dropped with the entry.
 */
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
    const reconciled = await reconcileOneUninstall(runner, next, settled, result);
    if (reconciled.remaining !== null) {
      next =
        reconciled.remaining.length === 0
          ? (withoutRecordedSelection(next, result.id) ?? next)
          : withRecordedSelection(
              next,
              result.id,
              reconciled.remaining,
              keepAssetsFor(next, result.id, reconciled.remaining),
            );
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
  context: SkillResolutionContext = {},
): Promise<CommandResult> => {
  const resolved = resolveEffectiveSkills(targets, args, record, context);
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
