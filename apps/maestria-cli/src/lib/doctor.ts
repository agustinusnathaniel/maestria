import { homedir } from 'node:os';

import {
  companionAgentFor,
  listCompanions,
  MANAGED_SKILLS,
  SKILLS_CLI_PACKAGE,
} from '@/lib/skill-companion.js';
import type { ObservedCompanion, SkillCommandRunner } from '@/lib/skill-companion.js';
import type { SkillsRecord } from '@/lib/skills.js';
import type { PlatformStatus } from '@/types.js';

/** Read-only legacy skill diagnostics (`maestria doctor`): never installs, removes, or records. */

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

interface ManagedSkillFindings {
  readonly missing: string[];
  readonly next: string[];
  readonly notes: string[];
  readonly unmanaged: string[];
}

/**
 * Classify maestria's managed skills for one agent: recorded and observed is a
 * legacy CLI install, observed but unrecorded duplicates the bundled skill, and
 * recorded but unobserved is a stale record entry.
 */
const classifyManagedSkills = (
  platformId: string,
  agentName: string,
  recordedManaged: readonly string[],
  observedByName: ReadonlyMap<string, string>,
  inventoryChecked: boolean,
): ManagedSkillFindings => {
  const notes: string[] = [];
  const next: string[] = [];
  const legacy = recordedManaged.filter((skill) => observedByName.has(skill));
  for (const skill of legacy) {
    notes.push(
      `Legacy CLI-installed copy of '${skill}' at ${redactHome(observedByName.get(skill) ?? '')}; ` +
        `the maestria package now bundles ${skill}. Run 'maestria update ${platformId}' to remove it.`,
    );
  }
  if (legacy.length > 0) {
    next.push(`Run 'maestria update ${platformId}' to remove legacy CLI-installed copies.`);
  }
  const unmanaged = MANAGED_SKILLS.filter(
    (skill) => observedByName.has(skill) && !recordedManaged.includes(skill),
  );
  for (const skill of unmanaged) {
    const command = `npx -y ${SKILLS_CLI_PACKAGE} remove ${skill} -a ${agentName} -g -y`;
    notes.push(
      `Independently installed copy of '${skill}' at ${redactHome(observedByName.get(skill) ?? '')} duplicates the bundled skill. ` +
        `Remove it only if it came from maestria: ${command}`,
    );
    next.push(`Remove the duplicate manually if it came from maestria: ${command}`);
  }
  const missing = recordedManaged.filter((skill) => !observedByName.has(skill));
  for (const skill of missing) {
    notes.push(
      `Recorded copy of '${skill}' is not observed for agent '${agentName}'; ` +
        `the record entry is cleaned on next update.`,
    );
  }
  if (missing.length > 0) {
    next.push(`Run 'maestria update ${platformId}' to clean the record.`);
  }
  if (inventoryChecked && legacy.length === 0 && unmanaged.length === 0 && missing.length === 0) {
    notes.push('Skills are bundled with the maestria package; nothing to clean up.');
  }
  return { missing, next, notes, unmanaged };
};

/** Build one platform report; list failures degrade into notes via `listError`. */
const buildDoctorReport = (
  status: DoctorStatus,
  record: SkillsRecord | null,
  observed: ObservedCompanion[],
  options: { listError?: string } = {},
): DoctorPlatformReport => {
  const agent = companionAgentFor(status.id);
  const agentName = agent ?? status.id;
  const recorded = record?.platforms[status.id]?.skills ?? null;
  const notes: string[] = [];
  const next: string[] = [];
  const listError = options.listError ?? '';

  if (agent === null) {
    notes.push(
      `Skills are bundled with the maestria package; nothing to check for '${status.id}' (no skills-CLI target).`,
    );
  }
  if (listError !== '') {
    notes.push(`Skill inventory check failed for agent '${agentName}': ${listError}`);
    next.push(`Re-run 'maestria doctor' once the skills CLI list works again.`);
  }
  const findings = classifyManagedSkills(
    status.id,
    agentName,
    (recorded ?? []).filter((skill) => MANAGED_SKILLS.includes(skill)),
    new Map(observed.map((entry) => [entry.name, entry.path])),
    agent !== null && listError === '',
  );
  notes.push(...findings.notes);
  next.push(...findings.next);
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
    missing: findings.missing,
    next: [...new Set(next)],
    notes,
    observed: observed.map((entry) => ({ name: entry.name, path: redactHome(entry.path) })),
    recorded,
    unmanaged: findings.unmanaged,
  };
};

/** Collect read-only reports; list failures degrade into per-platform notes. */
export const collectDoctorReports = async (
  runner: SkillCommandRunner,
  statuses: readonly PlatformStatus[],
  record: SkillsRecord | null,
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
    return buildDoctorReport(
      status,
      record,
      agent === null ? [] : (inventories.get(agent) ?? []),
      agent !== null && failures.has(agent) ? { listError: failures.get(agent) ?? '' } : {},
    );
  });
};
