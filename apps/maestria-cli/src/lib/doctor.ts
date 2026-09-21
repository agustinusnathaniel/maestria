import { homedir } from 'node:os';

import { companionAgentFor, listCompanions, MANAGED_SKILLS } from '@/lib/skill-companion.js';
import type { ObservedCompanion, SkillCommandRunner } from '@/lib/skill-companion.js';
import { resolveSkillsSource } from '@/lib/skill-reconcile.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';

/**
 * Read-only skill setup diagnostics (`maestria doctor`).
 *
 * The collector never installs, updates, removes, or records anything: it
 * combines existing plugin detection with the v2 skill selection record and
 * the tool-observed `list --json` inventory per native agent. Identity flows
 * through tool output only; this module keeps no path registry and parses no
 * lockfiles.
 */

export interface SharedSkillNote {
  readonly providers: string[];
  readonly path: string;
  readonly skill: string;
}

export interface DoctorPlatformReport {
  readonly agent: string | null;
  readonly available: boolean;
  readonly id: string;
  readonly installed: boolean;
  readonly installedVersion: string;
  readonly label: string;
  readonly listError?: string;
  readonly missing: string[];
  readonly next: string[];
  readonly notes: string[];
  readonly observed: ObservedCompanion[];
  readonly recorded: string[] | null;
  readonly shared: SharedSkillNote[];
  readonly unmanaged: string[];
}

export interface DoctorOutput {
  readonly platforms: DoctorPlatformReport[];
  readonly recordPath: string;
  readonly recordPresent: boolean;
}

/** Replace a leading home directory with `~` so reports avoid absolute private paths. */
export const redactHome = (value: string): string => {
  const home = homedir();
  if (home !== '' && (value === home || value.startsWith(`${home}/`))) {
    return `~${value.slice(home.length)}`;
  }
  return value;
};

const redactObserved = (entries: ObservedCompanion[]): ObservedCompanion[] =>
  entries.map((entry) => ({ name: entry.name, path: redactHome(entry.path) }));

/**
 * Platforms in another record entry that already claim this skill from the
 * same source at the same observed path (shared canonical targets such as
 * `~/.agents/skills`, reached via several agent IDs).
 */
const sharedProviders = (
  record: SkillsRecord | null,
  platformId: string,
  skill: string,
  observed: string,
  source: string,
): string[] =>
  Object.entries(record?.platforms ?? {})
    .filter(
      ([otherId, entry]) =>
        otherId !== platformId &&
        entry.skills.includes(skill) &&
        entry.skillAssets?.[skill]?.source === source &&
        entry.skillAssets?.[skill]?.path === observed,
    )
    .map(([otherId]) => otherId);

type DoctorStatus = Pick<
  PlatformStatus,
  'available' | 'id' | 'installed' | 'installedVersion' | 'label'
>;

interface UnmanagedGuidance {
  readonly next: string;
  readonly note: string;
  readonly shared?: SharedSkillNote;
}

/** Note plus next step for one observed-but-unrecorded managed skill. */
const describeUnmanaged = (
  record: SkillsRecord | null,
  platformId: string,
  skill: string,
  observedPath: string,
  source: string,
): UnmanagedGuidance => {
  const providers = sharedProviders(record, platformId, skill, observedPath, source);
  if (providers.length > 0) {
    return {
      next: `Run 'maestria install ${platformId}' to share the recorded copy.`,
      note: `Skill '${skill}' at ${redactHome(observedPath)} is already provided by ${providers.map((p) => `'${p}'`).join(', ')} from the same source.`,
      shared: { path: redactHome(observedPath), providers, skill },
    };
  }
  return {
    next: `Run 'maestria install ${platformId} --exclude-skills ${skill}' to leave it alone, or remove it manually first.`,
    note: `Existing unmanaged skill '${skill}' at ${redactHome(observedPath)} has no Maestria selection record.`,
  };
};

/** Notes plus next steps for record state, availability, and missing skills. */
const recordGuidance = (
  recorded: readonly string[] | null,
  status: Pick<PlatformStatus, 'available' | 'id' | 'installed'>,
  missing: readonly string[],
): { next: string[]; notes: string[] } => {
  const next: string[] = [];
  const notes: string[] = [];
  if (missing.length > 0) {
    next.push(`Run 'maestria update ${status.id}' to restore the recorded selection.`);
  }
  if (recorded === null) {
    notes.push('No Maestria skill selection is recorded for this platform.');
    next.push(`Run 'maestria install ${status.id}' to record a selection.`);
  }
  if (!status.available) {
    notes.push('Platform CLI is not available on this machine; skill inventory was not checked.');
  } else if (!status.installed) {
    next.push(`Run 'maestria install ${status.id}' to install the plugin.`);
  }
  return { next, notes };
};

/**
 * Unmanaged findings for one platform: managed skills observed with no
 * record, each with its note, next step, and optional shared-path detail.
 */
const collectUnmanaged = (
  record: SkillsRecord | null,
  platformId: string,
  recordedManaged: readonly string[],
  observed: readonly ObservedCompanion[],
  source: string,
): { next: string[]; notes: string[]; shared: SharedSkillNote[]; unmanaged: string[] } => {
  const observedByName = new Map(observed.map((entry) => [entry.name, entry.path]));
  const unmanaged = MANAGED_SKILLS.filter(
    (skill) => observedByName.has(skill) && !recordedManaged.includes(skill),
  );
  const next: string[] = [];
  const notes: string[] = [];
  const shared: SharedSkillNote[] = [];
  for (const skill of unmanaged) {
    const guidance = describeUnmanaged(
      record,
      platformId,
      skill,
      observedByName.get(skill) ?? '',
      source,
    );
    if (guidance.shared !== undefined) {
      shared.push(guidance.shared);
    }
    notes.push(guidance.note);
    next.push(guidance.next);
  }
  return { next, notes, shared, unmanaged };
};

/**
 * Build one platform report from already collected inputs. Pure apart from
 * home redaction: list failures arrive as `listError` and degrade honestly.
 */
export const buildDoctorReport = (
  status: DoctorStatus,
  record: SkillsRecord | null,
  observed: ObservedCompanion[],
  options: { listError?: string; source?: string } = {},
): DoctorPlatformReport => {
  const agent = companionAgentFor(status.id);
  const recorded = record?.platforms[status.id]?.skills ?? null;
  const source = options.source ?? resolveSkillsSource();
  const notes: string[] = [];
  const next: string[] = [];

  if (agent === null) {
    notes.push(
      `No skills-CLI target is verified for '${status.id}'; core reviewable-body fallback applies.`,
    );
    next.push(`Manage skills manually: npx -y skills@1.7.0 add ${source} --skill <skill> -g -y`);
  }
  const listError = options.listError ?? '';
  if (listError !== '') {
    notes.push(`Skill inventory check failed for agent '${agent ?? status.id}': ${listError}`);
    next.push(`Re-run 'maestria doctor' once the skills CLI list works again.`);
  }

  const recordedManaged = (recorded ?? []).filter((skill) => MANAGED_SKILLS.includes(skill));
  const found = collectUnmanaged(record, status.id, recordedManaged, observed, source);
  const observedNames = new Set(observed.map((entry) => entry.name));
  const missing = recordedManaged.filter((skill) => !observedNames.has(skill));

  notes.push(...found.notes);
  next.push(...found.next);
  for (const skill of missing) {
    notes.push(`Recorded skill '${skill}' is not observed for agent '${agent ?? status.id}'.`);
  }
  const guidance = recordGuidance(recorded, status, missing);
  notes.push(...guidance.notes);
  next.push(...guidance.next);

  return {
    ...(listError === '' ? {} : { listError }),
    agent,
    available: status.available,
    id: status.id,
    installed: status.installed,
    installedVersion: status.installedVersion,
    label: status.label,
    missing,
    next: [...new Set(next)],
    notes,
    observed: redactObserved(observed),
    recorded,
    shared: found.shared,
    unmanaged: found.unmanaged,
  };
};

/**
 * Collect read-only reports for every known status plus record-only platform
 * IDs (unknown platforms degrade honestly with no list call). Lists once per
 * distinct native agent; list failures degrade into per-platform notes.
 */
export const collectDoctorReports = async (
  runner: SkillCommandRunner,
  statuses: readonly PlatformStatus[],
  record: SkillsRecord | null,
  source: string = resolveSkillsSource(),
): Promise<DoctorPlatformReport[]> => {
  const ids = statuses.map((s) => s.id);
  for (const id of Object.keys(record?.platforms ?? {})) {
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const statusFor = (id: string): PlatformStatus =>
    byId.get(id) ?? {
      available: false,
      id,
      installed: false,
      installedVersion: '',
      label: id,
      latestVersion: '',
    };

  const agents = new Map<string, string | null>();
  for (const id of ids) {
    const agent = companionAgentFor(id);
    if (agent !== null && !agents.has(agent)) {
      agents.set(agent, agent);
    }
  }
  const inventories = new Map<string, ObservedCompanion[]>();
  const failures = new Map<string, string>();
  for (const agent of agents.keys()) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential read-only lists keep failure order deterministic.
      inventories.set(agent, await listCompanions(runner, agent, { global: true }));
    } catch (error) {
      failures.set(agent, error instanceof Error ? error.message : String(error));
      inventories.set(agent, []);
    }
  }

  return ids.map((id) => {
    const status = statusFor(id);
    const agent = companionAgentFor(id);
    return buildDoctorReport(status, record, agent === null ? [] : (inventories.get(agent) ?? []), {
      ...(agent !== null && failures.has(agent) ? { listError: failures.get(agent) ?? '' } : {}),
      source,
    });
  });
};
