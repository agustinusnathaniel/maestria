/** Kimi-code plugin registry helpers — extracted from platforms.ts for cohesion. */
import { Effect } from 'effect';
import { homedir } from 'node:os';

import { CommandError } from '@/lib/shell.js';

type JsonRecord = Record<string, unknown>;

const MAESTRIA_PLUGIN = 'maestria';

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isKimiInstalledRecord = (value: unknown): value is KimiInstalledRecord => {
  if (!isJsonRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.root === 'string' &&
    (value.source === 'local-path' || value.source === 'zip-url' || value.source === 'github') &&
    typeof value.enabled === 'boolean' &&
    typeof value.installedAt === 'string' &&
    (value.updatedAt === undefined || typeof value.updatedAt === 'string') &&
    (value.originalSource === undefined || typeof value.originalSource === 'string') &&
    (value.capabilities === undefined || isJsonRecord(value.capabilities)) &&
    (value.github === undefined || isJsonRecord(value.github))
  );
};

const isKimiInstalledRecords = (value: unknown): value is KimiInstalledRecord[] =>
  Array.isArray(value) && value.every(isKimiInstalledRecord);

export interface KimiInstalledRecord {
  readonly id: string;
  readonly root: string;
  readonly source: 'local-path' | 'zip-url' | 'github';
  readonly enabled: boolean;
  readonly installedAt: string;
  readonly updatedAt?: string;
  readonly originalSource?: string;
  readonly capabilities?: JsonRecord;
  readonly github?: JsonRecord;
}

export interface KimiInstalledFile {
  readonly version: 1;
  readonly plugins: KimiInstalledRecord[];
}

export const kimiCodeHome = (): string =>
  process.env.KIMI_CODE_HOME?.trim() ?? `${homedir()}/.kimi-code`;

export const kimiManagedPluginDir = (): string =>
  `${kimiCodeHome()}/plugins/managed/${MAESTRIA_PLUGIN}`;

export const kimiInstalledPath = (): string => `${kimiCodeHome()}/plugins/installed.json`;

export const readKimiInstalled = (): Effect.Effect<KimiInstalledFile, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `read ${kimiInstalledPath()}`,
        message: String(error),
      }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      const filePath = kimiInstalledPath();
      let text: string;
      try {
        text = await readFile(filePath, 'utf-8');
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return { plugins: [], version: 1 } satisfies KimiInstalledFile;
        }
        throw error;
      }
      const parsed: unknown = JSON.parse(text);
      if (!isJsonRecord(parsed)) {
        throw new TypeError('Kimi plugin registry must contain an object');
      }
      if (parsed.version !== undefined && parsed.version !== 1) {
        const version =
          typeof parsed.version === 'string' ||
          typeof parsed.version === 'number' ||
          typeof parsed.version === 'boolean'
            ? String(parsed.version)
            : JSON.stringify(parsed.version);
        throw new Error(`unsupported Kimi plugin registry version: ${version}`);
      }
      if (!isKimiInstalledRecords(parsed.plugins)) {
        throw new TypeError('Kimi plugin registry must contain a plugins array');
      }
      return {
        plugins: parsed.plugins,
        version: 1,
      } satisfies KimiInstalledFile;
    },
  });

export const writeKimiInstalled = (file: KimiInstalledFile): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `write ${kimiInstalledPath()}`,
        message: String(error),
      }),
    try: async () => {
      const { mkdir, rename, writeFile } = await import('node:fs/promises');
      const filePath = kimiInstalledPath();
      await mkdir(`${kimiCodeHome()}/plugins`, { recursive: true });
      const tempPath = `${filePath}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, 'utf-8');
      await rename(tempPath, filePath);
    },
  });

export const registerKimiPlugin = (): Effect.Effect<void, CommandError> =>
  Effect.gen(function* registerKimiPluginEffect() {
    const file = yield* readKimiInstalled();
    const now = new Date().toISOString();
    const current = file.plugins.find((plugin) => plugin.id === MAESTRIA_PLUGIN);
    const record: KimiInstalledRecord = {
      ...current,
      enabled: current?.enabled ?? true,
      id: MAESTRIA_PLUGIN,
      installedAt: current?.installedAt ?? now,
      originalSource: '@maestria/kimi-code',
      root: kimiManagedPluginDir(),
      source: 'local-path',
      updatedAt: now,
    };
    const plugins = file.plugins.filter((plugin) => plugin.id !== MAESTRIA_PLUGIN);
    plugins.push(record);
    yield* writeKimiInstalled({ plugins, version: 1 });
  });

export const removeKimiPlugin = (): Effect.Effect<void, CommandError> =>
  Effect.gen(function* removeKimiPluginEffect() {
    const file = yield* readKimiInstalled();
    const plugins = file.plugins.filter((plugin) => plugin.id !== MAESTRIA_PLUGIN);
    if (plugins.length !== file.plugins.length) {
      yield* writeKimiInstalled({ plugins, version: 1 });
    }
    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `remove ${kimiManagedPluginDir()}`,
          message: String(error),
        }),
      try: async () => {
        const { rm } = await import('node:fs/promises');
        await rm(kimiManagedPluginDir(), { force: true, recursive: true });
      },
    });
  });
