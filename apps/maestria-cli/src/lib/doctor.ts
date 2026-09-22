import { homedir } from 'node:os';

import { companionAgentFor, listCompanions, MANAGED_SKILLS } from '@/lib/skill-companion.js';
import type { ObservedCompanion, SkillCommandRunner } from '@/lib/skill-companion.js';
import { resolveSkillsSource } from '@/lib/skill-reconcile.js';
import { findSharedProviders } from '@/lib/skills.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';

/**
 * Read-only skill setup diagnostics (`maestria doctor`). The collector never
 * installs, updates, removes, or records anything: identity flows through
 * tool output only.
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

export const redactHome = (value: string): string => {
  const home = homedir();
  if (home !== '' && (value === home || value.startsWith(`${home}/`))) {
    return `~${value.slice(home.length)}`;
  }
  return value;
};

type DoctorStatus = Pick<
  PlatformStatus,
  'available' | 'id' | 'installed' | 'installedVersion' | 'label'
>;

/**
 * Build one platform report from already collected inputs. List failures
 * arrive as `listError` and degrade honestly.
 */
// oxlint-disable-next-line max-lines-per-function, complexity -- one report builder keeps note/next accumulation order in a single place; the sections share the same accumulators, so splitting would thread four out-params through helpers.
const buildDoctorReport = (
  status: DoctorStatus,
  record: SkillsRecord | null,
  observed: ObservedCompanion[],
  options: { listError?: string; source?: string } = {},
): DoctorPlatformReport => {
  const agent = companionAgentFor(status.id);
  const agentName = agent ?? status.id;
  const recorded = record?.platforms[status.id]?.skills ?? null;
  const source = options.source ?? resolveSkillsSource();
  const notes: string[] = [];
  const next: string[] = [];
  const shared: SharedSkillNote[] = [];

  if (agent === null) {
    notes.push(
      `No skills-CLI target is verified for '${status.id}'; core reviewable-body fallback applies.`,
    );
    next.push(`Manage skills manually: npx -y skills@1.7.0 add ${source} --skill <skill> -g -y`);
  }
  const listError = options.listError ?? '';
  if (listError !== '') {
    notes.push(`Skill inventory check failed for agent '${agentName}': ${listError}`);
    next.push(`Re-run 'maestria doctor' once the skills CLI list works again.`);
  }

  const recordedManaged = (recorded ?? []).filter((skill) => MANAGED_SKILLS.includes(skill));
  const observedByName = new Map(observed.map((entry) => [entry.name, entry.path]));
  const unmanaged = MANAGED_SKILLS.filter(
    (skill) => observedByName.has(skill) && !recordedManaged.includes(skill),
  );
  for (const skill of unmanaged) {
    const observedPath = observedByName.get(skill) ?? '';
    const providers = findSharedProviders(record, status.id, skill, observedPath, source);
    if (providers.length > 0) {
      notes.push(
        `Skill '${skill}' at ${redactHome(observedPath)} is already provided by ${providers.map((p) => `'${p}'`).join(', ')} from the same source.`,
      );
      next.push(`Run 'maestria install ${status.id}' to share the recorded copy.`);
      shared.push({ path: redactHome(observedPath), providers, skill });
    } else {
      notes.push(
        `Existing unmanaged skill '${skill}' at ${redactHome(observedPath)} has no Maestria selection record.`,
      );
      next.push(
        `Run 'maestria install ${status.id} --exclude-skills ${skill}' to leave it alone, or remove it manually first.`,
      );
    }
  }
  const missing = recordedManaged.filter((skill) => !observedByName.has(skill));

  for (const skill of missing) {
    notes.push(`Recorded skill '${skill}' is not observed for agent '${agentName}'.`);
  }
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
    observed: observed.map((entry) => ({ name: entry.name, path: redactHome(entry.path) })),
    recorded,
    shared,
    unmanaged,
  };
};

/**
 * Collect read-only reports for every known status plus record-only platform
 * IDs. Lists once per distinct native agent; list failures degrade into
 * per-platform notes.
 */
export const collectDoctorReports = async (
  runner: SkillCommandRunner,
  statuses: readonly PlatformStatus[],
  record: SkillsRecord | null,
  source: string = resolveSkillsSource(),
): Promise<DoctorPlatformReport[]> => {
  const ids = [...new Set([...statuses.map((s) => s.id), ...Object.keys(record?.platforms ?? {})])];
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

  const agents = new Set<string>();
  for (const id of ids) {
    const agent = companionAgentFor(id);
    if (agent !== null) {
      agents.add(agent);
    }
  }
  const inventories = new Map<string, ObservedCompanion[]>();
  const failures = new Map<string, string>();
  for (const agent of agents) {
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
