import { Effect } from 'effect';
import { cp, mkdir, mkdtemp, readdir, realpath, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import {
  isFileNotFound,
  isRecord,
  isStringArray,
  isWithin,
  readJsonRecord,
} from '@/lib/primitives.js';
import { MAESTRIA_PLUGIN_PACKAGE } from '@/lib/package-constants.js';
import { getMaestriaCacheDir, run } from '@/lib/shell.js';

import { formatAgentPluginValidation, validateAgentPlugin } from './agent-plugin-validation.js';
import type { AgentPluginValidation } from './agent-plugin-validation.js';

export const AGENT_PLUGIN_PACKAGE = MAESTRIA_PLUGIN_PACKAGE;

export interface StageAgentPluginOptions {
  readonly destination?: string;
  readonly source?: string;
}

export interface StagedAgentPlugin extends AgentPluginValidation {
  readonly destination: string;
  readonly source: string;
}

export class AgentPluginError extends Error {
  override name = 'AgentPluginError';
}

const isAlreadyExists = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';

const expandHome = (value: string): string => {
  if (value === '~') {
    return homedir();
  }
  if (value.startsWith('~/')) {
    return path.join(homedir(), value.slice(2));
  }
  return value;
};

const isLocalSource = async (source: string): Promise<boolean> => {
  const expanded = expandHome(source);
  if (source.startsWith('.') || source.startsWith('/') || source.startsWith('~')) {
    return true;
  }
  try {
    await stat(expanded);
    return true;
  } catch {
    return false;
  }
};

const parseNpmPackFilename = (output: string): string => {
  const parsed: unknown = JSON.parse(output) as unknown;
  if (!Array.isArray(parsed)) {
    return '';
  }
  const first: unknown = parsed[0];
  if (!isRecord(first)) {
    return '';
  }
  const { filename } = first;
  return typeof filename === 'string' ? filename : '';
};

const unpackNpmSource = async (source: string): Promise<{ root: string; tempDir: string }> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'maestria-agent-plugin-'));
  const unpackedRoot = path.join(tempDir, 'package');
  try {
    await mkdir(unpackedRoot);
    const output = await Effect.runPromise(
      run(
        'npm',
        ['pack', source, '--pack-destination', tempDir, '--json', '--ignore-scripts'],
        120_000,
      ),
    );
    const filename = parseNpmPackFilename(output);
    if (filename === '') {
      throw new AgentPluginError(`npm pack returned no tarball for ${source}`);
    }
    const archive = path.join(tempDir, path.basename(filename));
    await Effect.runPromise(
      run(
        'tar',
        [
          '-xzf',
          archive,
          '-C',
          unpackedRoot,
          '--strip-components=1',
          '--no-same-owner',
          '--no-same-permissions',
        ],
        120_000,
      ),
    );
    return { root: unpackedRoot, tempDir };
  } catch (error) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }
};

const validateLocalSourceRoot = async (source: string): Promise<string> => {
  const root = path.resolve(expandHome(source));
  const report = await validateAgentPlugin(root);
  if (!report.valid) {
    throw new AgentPluginError(formatAgentPluginValidation(report));
  }
  return report.root;
};

const resolveSourceRoot = async (source: string): Promise<{ root: string; tempDir?: string }> => {
  if (await isLocalSource(source)) {
    return { root: await validateLocalSourceRoot(source) };
  }
  return await unpackNpmSource(source);
};

const safePathSegment = (value: string): string => {
  const encoded = encodeURIComponent(value);
  return encoded === '.' || encoded === '..' || encoded === '' ? 'unversioned' : encoded;
};

const isSafeRelativePath = (value: string): boolean =>
  value !== '' &&
  !value.includes('\\') &&
  !value.includes('\0') &&
  !path.posix.isAbsolute(value) &&
  !path.win32.isAbsolute(value) &&
  !value.split('/').includes('..');

const containedSourcePath = async (root: string, relative: string): Promise<string> => {
  if (!isSafeRelativePath(relative)) {
    throw new AgentPluginError(`Invalid staged file path: ${relative}`);
  }
  const resolved = await realpath(path.join(root, relative));
  if (!isWithin(root, resolved)) {
    throw new AgentPluginError(`${relative} resolves outside the plugin root`);
  }
  return resolved;
};

const npmPublishedFiles = async (root: string): Promise<string[] | undefined> => {
  let metadata;
  try {
    metadata = await readJsonRecord(await containedSourcePath(root, 'package.json'));
  } catch (error) {
    if (isFileNotFound(error)) {
      return undefined;
    }
    throw error;
  }
  if (metadata.files === undefined) {
    return undefined;
  }
  if (!isStringArray(metadata.files) || !metadata.files.every(isSafeRelativePath)) {
    throw new AgentPluginError('package.json files must contain safe relative publish paths');
  }
  const cache = await mkdtemp(path.join(tmpdir(), 'maestria-agent-plugin-pack-'));
  try {
    const output = await Effect.runPromise(
      run(
        'npm',
        ['pack', root, '--dry-run', '--json', '--ignore-scripts', '--cache', cache],
        120_000,
      ),
    );
    const parsed: unknown = JSON.parse(output) as unknown;
    const result: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
    if (!isRecord(result) || !Array.isArray(result.files)) {
      throw new AgentPluginError('npm pack returned no publishable file list');
    }
    return result.files.map((entry: unknown) => {
      if (!isRecord(entry) || typeof entry.path !== 'string' || !isSafeRelativePath(entry.path)) {
        throw new AgentPluginError('npm pack returned an invalid staged file path');
      }
      return entry.path;
    });
  } finally {
    await rm(cache, { force: true, recursive: true });
  }
};

interface PluginEntry {
  readonly directory: boolean;
  readonly relative: string;
}

const directoryEntries = async (
  root: string,
  relative = '.',
  ancestors: ReadonlySet<string> = new Set(),
): Promise<PluginEntry[]> => {
  const resolved = await containedSourcePath(root, relative);
  const info = await stat(resolved);
  if (info.isFile()) {
    return [{ directory: false, relative }];
  }
  if (!info.isDirectory()) {
    throw new AgentPluginError(`${relative} must be a regular file or directory`);
  }
  if (ancestors.has(resolved)) {
    throw new AgentPluginError(`${relative} contains a cyclic directory symlink`);
  }
  const nextAncestors = new Set([...ancestors, resolved]);
  const entries: PluginEntry[] = relative === '.' ? [] : [{ directory: true, relative }];
  const names = await readdir(resolved);
  const children = await Promise.all(
    names.map(
      async (name) => await directoryEntries(root, path.posix.join(relative, name), nextAncestors),
    ),
  );
  return [...entries, ...children.flat()];
};

const pluginPayload = async (root: string): Promise<PluginEntry[]> => {
  const published = await npmPublishedFiles(root);
  if (published === undefined) {
    return await directoryEntries(root);
  }
  return await Promise.all(
    published.map(async (relative) => {
      const resolved = await containedSourcePath(root, relative);
      const info = await stat(resolved);
      if (!info.isFile()) {
        throw new AgentPluginError(`${relative} must be a regular published file`);
      }
      return { directory: false, relative };
    }),
  );
};

const copyPluginDirectory = async (
  source: string,
  destination: string,
  entries: readonly PluginEntry[],
): Promise<void> => {
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const target = path.join(destination, entry.relative);
      if (entry.directory) {
        await mkdir(target, { recursive: true });
      } else {
        await mkdir(path.dirname(target), { recursive: true });
        await cp(await containedSourcePath(source, entry.relative), target, {
          errorOnExist: true,
          force: false,
        });
      }
    }),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure !== undefined) {
    throw failure.reason;
  }
};

export const stageAgentPlugin = async (
  options: StageAgentPluginOptions = {},
): Promise<StagedAgentPlugin> => {
  const trimmedSource = options.source?.trim();
  const source =
    trimmedSource === undefined || trimmedSource === '' ? AGENT_PLUGIN_PACKAGE : trimmedSource;
  const resolved = await resolveSourceRoot(source);
  try {
    const report = await validateAgentPlugin(resolved.root);
    if (!report.valid || report.name === undefined) {
      throw new AgentPluginError(formatAgentPluginValidation(report).trim());
    }
    const entries = await pluginPayload(resolved.root);
    const versionSegment = safePathSegment(report.version ?? 'unversioned');
    const defaultDestination = path.join(
      getMaestriaCacheDir(),
      'agent-plugins',
      report.name,
      versionSegment,
    );
    const destination = path.resolve(expandHome(options.destination ?? defaultDestination));
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await mkdir(destination);
    } catch (error) {
      if (isAlreadyExists(error)) {
        throw new AgentPluginError(
          `Destination already exists: ${destination}. Choose another destination or remove it first.`,
        );
      }
      throw error;
    }
    try {
      await copyPluginDirectory(resolved.root, destination, entries);
      const installed = await validateAgentPlugin(destination);
      if (!installed.valid) {
        throw new AgentPluginError(formatAgentPluginValidation(installed).trim());
      }
      return { ...installed, destination, source };
    } catch (error) {
      await rm(destination, { force: true, recursive: true });
      throw error;
    }
  } finally {
    if (resolved.tempDir !== undefined) {
      await rm(resolved.tempDir, { force: true, recursive: true });
    }
  }
};
