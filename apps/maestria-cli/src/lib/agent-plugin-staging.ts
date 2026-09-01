import { Effect } from 'effect';
import { cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { getMaestriaCacheDir, run } from '@/lib/shell.js';

import { formatAgentPluginValidation, validateAgentPlugin } from './agent-plugin-validation.js';
import type { AgentPluginValidation } from './agent-plugin-validation.js';

export const AGENT_PLUGIN_PACKAGE = '@maestria/agent-plugin';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const copyPluginDirectory = async (source: string, destination: string): Promise<void> => {
  const entries = await readdir(source);
  await Promise.all(
    entries.map(async (entry) => {
      await cp(path.join(source, entry), path.join(destination, entry), {
        errorOnExist: true,
        force: false,
        recursive: true,
      });
    }),
  );
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
      await copyPluginDirectory(resolved.root, destination);
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
