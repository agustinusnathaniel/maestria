/** Kimi-code plugin registry helpers — extracted from platforms.ts for cohesion. */
import { Effect } from 'effect';
import { homedir } from 'node:os';

import { CommandError } from '@/lib/shell.js';

type JsonRecord = Record<string, unknown>;

const MAESTRIA_PLUGIN = 'maestria';

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

export function kimiCodeHome(): string {
  return process.env.KIMI_CODE_HOME?.trim() ?? `${homedir()}/.kimi-code`;
}

export function kimiManagedPluginDir(): string {
  return `${kimiCodeHome()}/plugins/managed/${MAESTRIA_PLUGIN}`;
}

export function kimiInstalledPath(): string {
  return `${kimiCodeHome()}/plugins/installed.json`;
}

export function readKimiInstalled(): Effect.Effect<KimiInstalledFile, CommandError> {
  return Effect.tryPromise({
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
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { plugins: [], version: 1 } satisfies KimiInstalledFile;
        }
        throw error;
      }
      const parsed = JSON.parse(text) as Partial<KimiInstalledFile>;
      if (parsed.version !== undefined && parsed.version !== 1) {
        throw new Error(`unsupported Kimi plugin registry version: ${String(parsed.version)}`);
      }
      if (!Array.isArray(parsed.plugins)) {
        throw new TypeError('Kimi plugin registry must contain a plugins array');
      }
      return {
        plugins: parsed.plugins,
        version: 1,
      } satisfies KimiInstalledFile;
    },
  });
}

export function writeKimiInstalled(file: KimiInstalledFile): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
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
}

export function registerKimiPlugin(): Effect.Effect<void, CommandError> {
  return Effect.gen(function* () {
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
}

export function removeKimiPlugin(): Effect.Effect<void, CommandError> {
  return Effect.gen(function* () {
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
}
