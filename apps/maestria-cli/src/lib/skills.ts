import { CliError } from '@/lib/command-result.js';
import { isFileNotFound, isRecord, isStringArray } from '@/lib/primitives.js';
import { getMaestriaConfigDir } from '@/lib/shell.js';
import path from 'node:path';

/**
 * Methodology skill selection for Maestria-managed installations.
 *
 * Only `create-pull-request` is selectable today; `none` explicitly selects
 * no skills. Fresh installs default to all current default skills except an
 * explicit opt-out. Legacy installs lacking a record receive an inferred
 * migration: `create-pull-request` is an extracted existing capability (the
 * PR delivery contract previously lived in core), not a new optional
 * workflow, so the inferred selection includes it. There was no prior
 * exclusion mechanism, so inference cannot silently re-enable an explicit
 * exclusion.
 *
 * Selections are stored per platform (not one global excluded list) so a
 * future default or per-host intent is preserved independently. The record is
 * a durable user preference at `$XDG_CONFIG_HOME/maestria/skills.json`
 * (fallback `~/.config/maestria/skills.json`), owned by the CLI. Runtime
 * plugins never read it; the CLI enforces selections by installing or
 * removing the companion skill through the external skills CLI.
 */

export const SKILLS_RECORD_VERSION = 1;
export const DEFAULT_SKILLS: readonly string[] = ['create-pull-request'];
export const KNOWN_SKILLS: readonly string[] = [...DEFAULT_SKILLS];
const NONE_TOKEN = 'none';

export const getSkillsRecordPath = (): string => {
  // Test and isolation override: a temp dir keeps CLI selection state out of
  // the real user config during tests and fake execution boundaries.
  const override = process.env.MAESTRIA_CONFIG_DIR?.trim();
  const base = override !== undefined && override !== '' ? override : getMaestriaConfigDir();
  return path.join(base, 'skills.json');
};

export interface PlatformSkillSelection {
  readonly skills: string[];
  readonly updatedAt?: string;
  /**
   * Minimal history of our own successful operations: the source the skill
   * was installed from plus the native path the tool observed in its own
   * machine output. Paths are never trusted from disk; identity is always
   * re-observed with `list --json` before mutation.
   */
  readonly source?: string;
  readonly path?: string;
}

export interface SkillsRecord {
  readonly version: number;
  readonly platforms: Record<string, PlatformSkillSelection>;
}

export const parseSkillsRecord = (text: string, source: string): SkillsRecord => {
  const corrupt = (detail: string): CliError =>
    new CliError(`Skill selection record is corrupt (${detail}): ${source}`, 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw corrupt('invalid JSON');
  }
  if (!isRecord(parsed)) {
    throw corrupt('not an object');
  }
  const { platforms: platformsValue, version } = parsed;
  if (version !== SKILLS_RECORD_VERSION) {
    throw new CliError(
      `Skill selection record version ${String(version)} is unsupported (expected ${SKILLS_RECORD_VERSION}): ${source}`,
      1,
    );
  }
  if (!isRecord(platformsValue)) {
    throw corrupt('platforms is not an object');
  }
  const platforms: Record<string, PlatformSkillSelection> = {};
  for (const [platformId, entry] of Object.entries(platformsValue)) {
    if (!isRecord(entry)) {
      throw corrupt(`platform '${platformId}' is not an object`);
    }
    const { skills } = entry;
    if (!isStringArray(skills)) {
      throw corrupt(`platform '${platformId}' skills is not a string array`);
    }
    const { path: recordPath, source: entrySource } = entry;
    if (recordPath !== undefined && typeof recordPath !== 'string') {
      throw corrupt(`platform '${platformId}' path is not a string`);
    }
    if (entrySource !== undefined && typeof entrySource !== 'string') {
      throw corrupt(`platform '${platformId}' source is not a string`);
    }
    // Unknown IDs are preserved, never reset: a newer writer may have stored
    // IDs this version does not know yet. Flag validation still rejects
    // unknown names on the command line.
    platforms[platformId] = {
      ...(typeof entrySource === 'string' ? { source: entrySource } : {}),
      ...(typeof recordPath === 'string' ? { path: recordPath } : {}),
      skills: [...skills],
    };
  }
  return { platforms, version: SKILLS_RECORD_VERSION };
};

export const readSkillsRecord = async (): Promise<SkillsRecord | null> => {
  const recordPath = getSkillsRecordPath();
  const { readFile } = await import('node:fs/promises');
  try {
    return parseSkillsRecord(await readFile(recordPath, 'utf-8'), recordPath);
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isFileNotFound(error)) {
      return null;
    }
    throw new CliError(`Skill selection record cannot be read: ${recordPath}: ${String(error)}`, 1);
  }
};

export const writeSkillsRecord = async (record: SkillsRecord): Promise<void> => {
  const recordPath = getSkillsRecordPath();
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(path.dirname(recordPath), { recursive: true });
  const payload = JSON.stringify(
    {
      platforms: Object.fromEntries(
        Object.entries(record.platforms).map(([id, entry]) => [
          id,
          {
            ...(entry.source === undefined ? {} : { source: entry.source }),
            ...(entry.path === undefined ? {} : { path: entry.path }),
            skills: entry.skills,
            updatedAt: new Date().toISOString(),
          },
        ]),
      ),
      version: SKILLS_RECORD_VERSION,
    },
    null,
    2,
  );
  await writeFile(recordPath, `${payload}\n`, 'utf-8');
};

const normalizeCsv = (value: string): string[] => [
  ...new Set(
    value
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),
];

const assertKnown = (ids: string[], flag: string): void => {
  const unknown = ids.filter((id) => id !== NONE_TOKEN && !KNOWN_SKILLS.includes(id));
  if (unknown.length > 0) {
    throw new CliError(
      `Unknown skill '${unknown[0]}' in ${flag}. Known skills: ${[...KNOWN_SKILLS, NONE_TOKEN].join(', ')}`,
      1,
    );
  }
};

export interface ResolvedSkillSelection {
  readonly skills: string[];
  readonly changed: boolean;
}

export interface ParsedSkillFlags {
  readonly excludeIds: string[] | null;
  readonly includeIds: string[] | null;
}

const assertNoConflict = (includeIds: string[], excludeIds: string[]): void => {
  const overlap = includeIds.filter((id) => excludeIds.includes(id) && id !== NONE_TOKEN);
  if (overlap.length > 0) {
    throw new CliError(
      `Conflicting skill selection: '${overlap[0]}' appears in both --skills and --exclude-skills`,
      1,
    );
  }
  if (includeIds.includes(NONE_TOKEN) && excludeIds.length > 0) {
    throw new CliError(
      `Conflicting skill selection: 'none' cannot be combined with --exclude-skills`,
      1,
    );
  }
};

/** Parse and validate flag CSVs; throws on unknown names or conflicts. */
export const parseSkillFlags = (options: {
  excludeSkills?: string;
  skills?: string;
}): ParsedSkillFlags => {
  const rawInclude = options.skills?.trim() ?? '';
  const rawExclude = options.excludeSkills?.trim() ?? '';
  const includeIds = rawInclude === '' ? null : normalizeCsv(rawInclude);
  const excludeIds = rawExclude === '' ? null : normalizeCsv(rawExclude);

  if (includeIds !== null) {
    assertKnown(includeIds, '--skills');
  }
  if (excludeIds !== null) {
    assertKnown(excludeIds, '--exclude-skills');
  }
  if (includeIds !== null && excludeIds !== null) {
    assertNoConflict(includeIds, excludeIds);
  }
  return { excludeIds, includeIds };
};

const changedVs = (recorded: string[] | null, skills: readonly string[]): boolean =>
  recorded === null || recorded.join(',') !== skills.join(',');

const applyIncludeIds = (
  includeIds: string[],
  recorded: string[] | null,
): ResolvedSkillSelection => {
  if (includeIds.includes(NONE_TOKEN)) {
    if (includeIds.length > 1) {
      throw new CliError(
        `Conflicting skill selection: 'none' cannot be combined with other skills`,
        1,
      );
    }
    return { changed: recorded === null || recorded.length > 0, skills: [] };
  }
  const skills = [...includeIds];
  return { changed: changedVs(recorded, skills), skills };
};

const applyExcludeIds = (
  excludeIds: string[],
  recorded: string[] | null,
): ResolvedSkillSelection => {
  const base = recorded ?? [...DEFAULT_SKILLS];
  const skills = base.filter((s) => !excludeIds.includes(s));
  return { changed: changedVs(recorded, skills), skills };
};

/**
 * Resolve the effective skill selection for a platform. Validates unknown
 * names and `--skills`/`--exclude-skills` conflicts BEFORE any external
 * effect; callers must invoke this before install/update/stage mutations.
 *
 * Precedence: explicit `--skills` > explicit `--exclude-skills` applied to
 * defaults > recorded choices (no-flag scripted updates preserve them) >
 * inferred default for legacy installs without a record.
 */
export const resolveSkillSelection = (
  platformId: string,
  options: { excludeSkills?: string; skills?: string },
  record: SkillsRecord | null,
): ResolvedSkillSelection => {
  const { excludeIds, includeIds } = parseSkillFlags(options);
  const recorded = record?.platforms[platformId]?.skills ?? null;

  if (includeIds !== null) {
    return applyIncludeIds(includeIds, recorded);
  }
  if (excludeIds !== null) {
    return applyExcludeIds(excludeIds, recorded);
  }
  if (recorded !== null) {
    return { changed: false, skills: [...recorded] };
  }
  return { changed: false, skills: [...DEFAULT_SKILLS] };
};

/** Record a successful per-platform selection (only after actual success). */
export const withRecordedSelection = (
  record: SkillsRecord | null,
  platformId: string,
  skills: string[],
  observed?: { path?: string; source?: string },
): SkillsRecord => ({
  platforms: {
    ...record?.platforms,
    [platformId]: {
      ...(observed?.source === undefined ? {} : { source: observed.source }),
      ...(observed?.path === undefined ? {} : { path: observed.path }),
      skills: [...skills],
    },
  },
  version: SKILLS_RECORD_VERSION,
});

/** Remove one platform's selection on uninstall, preserving other platforms. */
export const withoutRecordedSelection = (
  record: SkillsRecord | null,
  platformId: string,
): SkillsRecord | null => {
  if (record === null || !(platformId in record.platforms)) {
    return record;
  }
  const { [platformId]: _removed, ...rest } = record.platforms;
  return { platforms: rest, version: SKILLS_RECORD_VERSION };
};

export interface SkillFlagArgs {
  excludeSkills?: string;
  skills?: string;
}

export interface EffectiveSkillSelection {
  readonly id: string;
  readonly label?: string;
  readonly selection: ResolvedSkillSelection;
}

/** True when explicit skill flags were passed. */
export const hasSkillFlags = (args: SkillFlagArgs): boolean =>
  (args.skills?.trim() ?? '') !== '' || (args.excludeSkills?.trim() ?? '') !== '';

/**
 * Validate skill flags BEFORE any external effect. Unknown or conflicting
 * names throw here so no host mutation happens first.
 */
export const validateSkillFlags = (
  platformIds: readonly string[],
  args: SkillFlagArgs,
  record: SkillsRecord | null,
): void => {
  for (const id of platformIds.length > 0 ? platformIds : ['preview']) {
    resolveSkillSelection(id, args, record);
  }
};

/** Summarize selections for confirmation prompts. */
export const summarizeSelections = (
  selections: readonly { id: string; selection: ResolvedSkillSelection }[],
): string =>
  selections
    .map((entry) => `${entry.id}=[${entry.selection.skills.join(', ') || 'none'}]`)
    .join(', ');

/**
 * Persist selections only for platforms whose operation actually succeeded.
 * Failures keep their prior record; partial effects stay truthful. Observed
 * tool output (source key plus native path) is stored alongside selections
 * when the caller supplies it.
 */
export const persistSuccessfulSelections = async (
  record: SkillsRecord | null,
  effective: readonly {
    id: string;
    observed?: { path?: string; source?: string };
    selection: ResolvedSkillSelection;
  }[],
  results: readonly { id: string; ok: boolean }[],
  onlyChanged: boolean,
): Promise<void> => {
  const okIds = new Set(results.filter((result) => result.ok).map((result) => result.id));
  let next = record;
  for (const entry of effective) {
    if (okIds.has(entry.id) && (!onlyChanged || entry.selection.changed)) {
      next = withRecordedSelection(next, entry.id, entry.selection.skills, entry.observed);
    }
  }
  if (next !== record && next !== null) {
    await writeSkillsRecord(next);
  }
};
