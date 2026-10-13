import { CliError } from '@/lib/command-result.js';
import { isFileNotFound, isRecord, isStringArray } from '@/lib/primitives.js';
import { getMaestriaConfigDir } from '@/lib/shell.js';
import path from 'node:path';

/**
 * Legacy ownership record for CLI-installed copies. Packages bundle their own
 * skills now; this exists only for cleanup. Ownership never comes from the
 * filesystem, and unknown keys from newer writers are preserved.
 */

export const SKILLS_RECORD_VERSION = 2;

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
  /** Own successful operations, keyed by skill; unknown keys preserved. */
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
  // Newer writers may have stored IDs this version does not know.
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
  // Serialize before touching the filesystem.
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
  // Same-directory temp plus rename: atomic replacement, not concurrency control.
  const tempPath = `${recordPath}.${process.pid}.tmp`;
  try {
    await writeFile(tempPath, payload, 'utf-8');
    await rename(tempPath, recordPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
};

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
