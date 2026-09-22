import { CliError } from '@/lib/command-result.js';
import { isFileNotFound, isRecord, isStringArray } from '@/lib/primitives.js';
import { getMaestriaConfigDir } from '@/lib/shell.js';
import { COMPANION_SKILL, DOCS_UPDATE_SKILL } from '@/lib/skill-companion.js';
import path from 'node:path';

/**
 * Methodology skill selection for Maestria-managed installations.
 *
 * Selections are stored per platform at `$XDG_CONFIG_HOME/maestria/skills.json`,
 * owned by the CLI and enforced through the external skills CLI. Fresh installs
 * default to all current skills; legacy updates without a record infer only
 * the prior PR skill, never the newer docs skill (no prior exclusion
 * mechanism existed, so inference cannot re-enable an explicit exclusion).
 * Observed tool output is kept per skill, never as one shared source/path.
 */

export const SKILLS_RECORD_VERSION = 2;
export const DEFAULT_SKILLS: readonly string[] = [COMPANION_SKILL, DOCS_UPDATE_SKILL];
/** No-record inference for the update path only (predates skill selection). */
export const LEGACY_UPDATE_SKILLS: readonly string[] = [COMPANION_SKILL];
export const KNOWN_SKILLS: readonly string[] = [...DEFAULT_SKILLS];
const NONE_TOKEN = 'none';

export const getSkillsRecordPath = (): string => {
  const override = process.env.MAESTRIA_CONFIG_DIR?.trim();
  const base = override !== undefined && override !== '' ? override : getMaestriaConfigDir();
  return path.join(base, 'skills.json');
};

export interface SkillAsset {
  readonly source?: string;
  readonly path?: string;
}

export interface PlatformSkillSelection {
  readonly skills: string[];
  readonly updatedAt?: string;
  /**
   * History of our own successful operations, keyed by skill. Paths are never
   * trusted from disk; unknown skill keys from newer writers are preserved.
   */
  readonly skillAssets?: Record<string, SkillAsset>;
}

export interface SkillsRecord {
  readonly version: number;
  readonly platforms: Record<string, PlatformSkillSelection>;
}

const parseSkillAsset = (
  value: unknown,
  platformId: string,
  skillId: string,
  source: string,
): SkillAsset | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new CliError(
      `Skill selection record is corrupt (platform '${platformId}' skill '${skillId}' asset is not an object): ${source}`,
      1,
    );
  }
  const { path: assetPath, source: assetSource } = value;
  if (assetPath !== undefined && typeof assetPath !== 'string') {
    throw new CliError(
      `Skill selection record is corrupt (platform '${platformId}' skill '${skillId}' path is not a string): ${source}`,
      1,
    );
  }
  if (assetSource !== undefined && typeof assetSource !== 'string') {
    throw new CliError(
      `Skill selection record is corrupt (platform '${platformId}' skill '${skillId}' source is not a string): ${source}`,
      1,
    );
  }
  return {
    ...(typeof assetSource === 'string' ? { source: assetSource } : {}),
    ...(typeof assetPath === 'string' ? { path: assetPath } : {}),
  };
};

const parseAssets = (
  entry: Record<string, unknown>,
  platformId: string,
  source: string,
): Record<string, SkillAsset> => {
  const { skillAssets } = entry;
  if (skillAssets === undefined) {
    return {};
  }
  if (!isRecord(skillAssets)) {
    throw new CliError(
      `Skill selection record is corrupt (platform '${platformId}' skillAssets is not an object): ${source}`,
      1,
    );
  }
  const assets: Record<string, SkillAsset> = {};
  for (const [skillId, asset] of Object.entries(skillAssets)) {
    const parsedAsset = parseSkillAsset(asset, platformId, skillId, source);
    if (parsedAsset !== undefined) {
      assets[skillId] = parsedAsset;
    }
  }
  return assets;
};

const parsePlatformEntry = (
  entry: unknown,
  platformId: string,
  source: string,
): PlatformSkillSelection => {
  if (!isRecord(entry)) {
    throw new CliError(
      `Skill selection record is corrupt (platform '${platformId}' is not an object): ${source}`,
      1,
    );
  }
  const { skills } = entry;
  if (!isStringArray(skills)) {
    throw new CliError(
      `Skill selection record is corrupt (platform '${platformId}' skills is not a string array): ${source}`,
      1,
    );
  }
  // Unknown IDs are preserved: a newer writer may have stored IDs this version
  // does not know yet.
  const assets = parseAssets(entry, platformId, source);
  return {
    ...(Object.keys(assets).length > 0 ? { skillAssets: assets } : {}),
    skills: [...skills],
  };
};

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
    platforms[platformId] = parsePlatformEntry(entry, platformId, source);
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
  // Serialize fully before touching the filesystem.
  const payload = `${JSON.stringify(
    {
      platforms: Object.fromEntries(
        Object.entries(record.platforms).map(([id, entry]) => [
          id,
          {
            ...(entry.skillAssets === undefined ? {} : { skillAssets: entry.skillAssets }),
            skills: entry.skills,
            updatedAt: new Date().toISOString(),
          },
        ]),
      ),
      version: SKILLS_RECORD_VERSION,
    },
    null,
    2,
  )}\n`;
  const { mkdir, rename, rm, writeFile } = await import('node:fs/promises');
  await mkdir(path.dirname(recordPath), { recursive: true });
  // Same-directory temp plus rename: readers never observe a half-written
  // record. Atomic replacement only, not concurrency control.
  const tempPath = `${recordPath}.${process.pid}.tmp`;
  try {
    await writeFile(tempPath, payload, 'utf-8');
    await rename(tempPath, recordPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
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

/** Fresh installs default to every current skill; legacy updates infer less. */
export interface SkillResolutionContext {
  /** True on the update path when no record exists yet. */
  readonly updateBootstrap?: boolean;
}

export const resolveSkillSelection = (
  platformId: string,
  options: { excludeSkills?: string; skills?: string },
  record: SkillsRecord | null,
  context: SkillResolutionContext = {},
): ResolvedSkillSelection => {
  const { excludeIds, includeIds } = parseSkillFlags(options);
  const recorded = record?.platforms[platformId]?.skills ?? null;
  const fallback = context.updateBootstrap === true ? LEGACY_UPDATE_SKILLS : DEFAULT_SKILLS;
  const changedVs = (skills: readonly string[]): boolean =>
    recorded === null || recorded.join(',') !== skills.join(',');

  if (includeIds !== null) {
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
    return { changed: changedVs(skills), skills };
  }
  if (excludeIds !== null) {
    const skills = (recorded ?? [...fallback]).filter((s) => !excludeIds.includes(s));
    return { changed: changedVs(skills), skills };
  }
  return { changed: false, skills: [...(recorded ?? fallback)] };
};

/** Platforms (other than `platformId`) whose record claims `skill` from the same source at `observedPath`. */
export const findSharedProviders = (
  record: SkillsRecord | null,
  platformId: string,
  skill: string,
  observedPath: string,
  source: string,
): string[] =>
  Object.keys(record?.platforms ?? {}).filter((otherId) => {
    if (otherId === platformId) {
      return false;
    }
    const entry = record?.platforms[otherId];
    if (entry === undefined) {
      return false;
    }
    return (
      entry.skills.includes(skill) &&
      entry.skillAssets?.[skill]?.source === source &&
      entry.skillAssets?.[skill]?.path === observedPath
    );
  });

export const isSharedRecordedAsset = (
  record: SkillsRecord | null,
  platformId: string,
  skill: string,
  observed: string,
  source: string,
): boolean => findSharedProviders(record, platformId, skill, observed, source).length > 0;

export const withRecordedSelection = (
  record: SkillsRecord | null,
  platformId: string,
  skills: string[],
  skillAssets?: Record<string, SkillAsset>,
): SkillsRecord => ({
  platforms: {
    ...record?.platforms,
    [platformId]: {
      ...(skillAssets === undefined || Object.keys(skillAssets).length === 0
        ? {}
        : { skillAssets: { ...skillAssets } }),
      skills: [...skills],
    },
  },
  version: SKILLS_RECORD_VERSION,
});

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

export const hasSkillFlags = (args: SkillFlagArgs): boolean =>
  (args.skills?.trim() ?? '') !== '' || (args.excludeSkills?.trim() ?? '') !== '';

export const validateSkillFlags = (
  platformIds: readonly string[],
  args: SkillFlagArgs,
  record: SkillsRecord | null,
): void => {
  for (const id of platformIds.length > 0 ? platformIds : ['preview']) {
    resolveSkillSelection(id, args, record);
  }
};

export const summarizeSelections = (
  selections: readonly { id: string; selection: ResolvedSkillSelection }[],
): string =>
  selections
    .map((entry) => `${entry.id}=[${entry.selection.skills.join(', ') || 'none'}]`)
    .join(', ');

/**
 * Persist selections only for platforms whose operation actually succeeded. A
 * failed skill is never recorded as installed; confirmed actuals persist
 * recoverably. Assets for dropped skills do not merge through.
 */
export const persistSuccessfulSelections = async (
  record: SkillsRecord | null,
  effective: readonly {
    id: string;
    actualSkills?: string[];
    observed?: Record<string, SkillAsset>;
    selection: ResolvedSkillSelection;
  }[],
  results: readonly { id: string; ok: boolean }[],
  onlyChanged: boolean,
): Promise<void> => {
  const okIds = new Set(results.filter((result) => result.ok).map((result) => result.id));
  let next = record;
  for (const entry of effective) {
    const actual = entry.actualSkills ?? entry.selection.skills;
    const partialSuccess =
      entry.actualSkills !== undefined && Object.keys(entry.observed ?? {}).length > 0;
    if ((!okIds.has(entry.id) && !partialSuccess) || (onlyChanged && !entry.selection.changed)) {
      continue;
    }
    const priorAssets = next?.platforms[entry.id]?.skillAssets ?? {};
    const kept = Object.fromEntries(
      Object.entries(priorAssets).filter(([skill]) => actual.includes(skill)),
    );
    next = withRecordedSelection(next, entry.id, actual, { ...kept, ...entry.observed });
  }
  if (next !== record && next !== null) {
    await writeSkillsRecord(next);
  }
};
