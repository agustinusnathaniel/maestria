// packages/core/scripts/lib/config.ts - Config types, loader & merge

import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ── Types ──

export interface ReplaceOp {
  from: string;
  to: string;
}

export interface FileConfig {
  output?: string;
  stripFrontmatter?: boolean;
  replace?: ReplaceOp[];
  prepend?: string;
  append?: string;
  autoGenComment?: string;
  frontmatter?: Record<string, unknown> | string | null;
}

export interface SyncConfig {
  source: string;
  output?: string;
  default?: FileConfig;
  files?: Record<string, FileConfig>;
  /** Relative paths (relative to output dir) to exclude from auto-clean */
  preserve?: string[];
}

export interface ResolvedSyncConfig {
  configPath: string;
  configDir: string;
  source: string;
  output: string;
  default?: FileConfig;
  files: Record<string, ResolvedFileConfig>;
  preserve: string[];
}

export interface ResolvedFileConfig {
  output: string;
  stripFrontmatter: boolean;
  replace: ReplaceOp[];
  prepend: string;
  append: string;
  frontmatter?: Record<string, unknown> | string | null;
  autoGenComment?: string;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

type ResolvedFileConfigValues = Omit<ResolvedFileConfig, 'output'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSyncConfig = (value: unknown): value is SyncConfig =>
  isRecord(value) && typeof value.source === 'string';

const mergeFileConfig = (
  fileCfg: FileConfig,
  defaultCfg: FileConfig | undefined,
): ResolvedFileConfigValues => ({
  append: fileCfg.append ?? defaultCfg?.append ?? '',
  autoGenComment: fileCfg.autoGenComment ?? defaultCfg?.autoGenComment ?? undefined,
  frontmatter: fileCfg.frontmatter === undefined ? defaultCfg?.frontmatter : fileCfg.frontmatter,
  prepend: fileCfg.prepend ?? defaultCfg?.prepend ?? '',
  replace: [...(defaultCfg?.replace ?? []), ...(fileCfg.replace ?? [])],
  stripFrontmatter: fileCfg.stripFrontmatter ?? defaultCfg?.stripFrontmatter ?? false,
});

const resolveFileOutput = (fileCfg: FileConfig, baseDir: string, filename: string): string => {
  if (fileCfg.output !== undefined && fileCfg.output !== null && fileCfg.output !== '') {
    return path.resolve(baseDir, fileCfg.output);
  }
  return path.resolve(baseDir, filename);
};

const resolveFileConfig = (
  fileCfg: FileConfig,
  defaultCfg: FileConfig | undefined,
  configDir: string,
  outputDir: string,
  filename: string,
): ResolvedFileConfig => {
  const baseDir = outputDir || configDir;
  return {
    ...mergeFileConfig(fileCfg, defaultCfg),
    output: resolveFileOutput(fileCfg, baseDir, filename),
  };
};

const resolveConfig = (
  raw: SyncConfig,
  configDir: string,
  configPath: string,
): ResolvedSyncConfig => {
  const source = path.resolve(configDir, raw.source);
  const output =
    raw.output !== undefined && raw.output !== null && raw.output !== ''
      ? path.resolve(configDir, raw.output)
      : '';

  const resolvedFiles: Record<string, ResolvedFileConfig> = {};

  if (raw.files) {
    for (const [filename, fileCfg] of Object.entries(raw.files)) {
      resolvedFiles[filename] = resolveFileConfig(
        fileCfg,
        raw.default,
        configDir,
        output,
        filename,
      );
    }
  }

  return {
    configDir,
    configPath,
    default: raw.default,
    files: resolvedFiles,
    output,
    preserve: raw.preserve ?? [],
    source,
  };
};

// ── Config Loading ──

export const loadConfig = async (configPath: string): Promise<ResolvedSyncConfig> => {
  const absPath = path.resolve(configPath);

  if (!existsSync(absPath)) {
    throw new ConfigError(`Config file not found: ${absPath}`);
  }

  let mod: unknown;
  try {
    mod = await import(pathToFileURL(absPath).href);
  } catch (error) {
    throw new ConfigError(`Failed to load config file: ${absPath}`, { cause: error });
  }

  const raw = isRecord(mod) && isSyncConfig(mod.default) ? mod.default : undefined;
  if (raw === undefined) {
    throw new ConfigError(`Config file must export a default object: ${absPath}`);
  }

  return resolveConfig(raw, path.dirname(absPath), absPath);
};
