// packages/core/scripts/lib/config.ts — Config types, loader & merge

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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
  configDir: string;
  source: string;
  output: string;
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
}

export class ConfigError extends Error {
  override name = 'ConfigError';
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

// ── Config Loading ──

export async function loadConfig(configPath: string): Promise<ResolvedSyncConfig> {
  const absPath = resolve(configPath);

  if (!existsSync(absPath)) {
    throw new ConfigError(`Config file not found: ${absPath}`);
  }

  let mod: { default?: SyncConfig };
  try {
    mod = await import(pathToFileURL(absPath).href);
  } catch (err) {
    throw new ConfigError(`Failed to load config file: ${absPath}`, { cause: err as Error });
  }

  const raw = mod.default;
  if (!raw) {
    throw new ConfigError(`Config file must export a default object: ${absPath}`);
  }

  return resolveConfig(raw, dirname(absPath));
}

function resolveConfig(raw: SyncConfig, configDir: string): ResolvedSyncConfig {
  const source = resolve(configDir, raw.source);
  const output = raw.output ? resolve(configDir, raw.output) : '';

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

  return { configDir, source, output, files: resolvedFiles, preserve: raw.preserve ?? [] };
}

function resolveFileConfig(
  fileCfg: FileConfig,
  defaultCfg: FileConfig | undefined,
  configDir: string,
  outputDir: string,
  filename: string,
): ResolvedFileConfig {
  const replace = [...(defaultCfg?.replace ?? []), ...(fileCfg.replace ?? [])];

  const stripFrontmatter = fileCfg.stripFrontmatter ?? defaultCfg?.stripFrontmatter ?? false;
  const prepend = fileCfg.prepend ?? defaultCfg?.prepend ?? '';
  const append = fileCfg.append ?? defaultCfg?.append ?? '';
  const frontmatter =
    fileCfg.frontmatter !== undefined ? fileCfg.frontmatter : defaultCfg?.frontmatter;

  const baseDir = outputDir || configDir;
  const fileOutput = fileCfg.output ? resolve(baseDir, fileCfg.output) : resolve(baseDir, filename);

  return { output: fileOutput, stripFrontmatter, replace, prepend, append, frontmatter };
}
