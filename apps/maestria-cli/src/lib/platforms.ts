// oxlint-disable max-lines -- platforms.ts is a cohesive registry aggregating 9 platform handlers (opencode, pi, prime-agent, kimi-code, hermes, cursor, claude-code, codex, omp) with shared helpers. Splitting the registry would fragment the single source for PLATFORM_IDS and platform lookup, harming discoverability and increasing cross-file churn for handler registration. The file's handlers share helpers (installNpmTarball, marketplace, codex agents) and are rarely edited together; file length is justified by cohesion.
import { Effect } from 'effect';
import { homedir, tmpdir } from 'os';
import { isAbsolute, join, win32 } from 'node:path';
import picocolors from 'picocolors';

import { MAESTRIA_AGENTS } from '@/lib/model-config.js';
import { codexManagedAgentFileName, mergeCodexAgentSettings } from '@/lib/codex-agent-files.js';
import {
  CODEX_GLOBAL_INSTRUCTION_FILENAMES,
  type CodexGlobalInstructionFilename,
  hasCodexManagedInstructions,
  removeCodexManagedInstructions,
  upsertCodexManagedInstructions,
} from '@/lib/codex-instructions.js';
import {
  run,
  readTextFile,
  fileExists,
  commandExists,
  npmViewVersion,
  invalidateVersionCache,
  CommandError,
  getCacheDir,
  getMaestriaCacheDir,
} from '@/lib/shell.js';
import {
  kimiCodeHome,
  kimiManagedPluginDir,
  kimiInstalledPath,
  readKimiInstalled,
  registerKimiPlugin,
  removeKimiPlugin,
} from '@/lib/kimi.js';

// ── Shared helpers ───────────────────────────────────

/** Read OpenCode config file, trying .jsonc first then .json */
function readOpenCodeConfig(): Effect.Effect<string, CommandError> {
  const jsoncPath = `${homedir()}/.config/opencode/opencode.jsonc`;
  const jsonPath = `${homedir()}/.config/opencode/opencode.json`;
  return readTextFile(jsoncPath).pipe(
    Effect.catchCause(() => {
      return readTextFile(jsonPath);
    }),
  );
}

/**
 * Install a package from an npm tarball into a destination directory.
 *
 * Shared by the kimi-code and cursor platform handlers, which both pack
 * @maestria/* packages to /tmp and extract them into their platform's
 * plugin directory. The tarball name derives from the package name with
 * the @maestria/ scope stripped (e.g. @maestria/kimi-code ->
 * maestria-kimi-code-*.tgz).
 *
 * @param pkg    Full npm package name (e.g. '@maestria/kimi-code')
 * @param dest   Destination directory to extract into
 * @param opts   Optional npm dist-tag (default 'latest')
 */
function cleanupStaleTarball(
  tmpDir: string,
  prefix: string,
  dest: string,
): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readdir, unlink, rm } = await import('node:fs/promises');
      const entries = await readdir(tmpDir);
      const stale = entries.filter((e) => {
        return e.startsWith(prefix) && e.endsWith('.tgz');
      });
      await Promise.all(
        stale.map((e) => {
          return unlink(join(tmpDir, e));
        }),
      );
      await rm(dest, { recursive: true, force: true });
    },
    catch: (error) => {
      return new CommandError({
        command: `cleanup ${tmpDir}/${prefix}*.tgz and ${dest}`,
        message: String(error),
      });
    },
  });
}

function findPackedTarball(
  tmpDir: string,
  prefix: string,
  pkgAtTag: string,
): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(tmpDir);
      const matches = entries.filter((e) => {
        return e.startsWith(prefix) && e.endsWith('.tgz');
      });
      if (matches.length === 0) {
        throw new Error(`no tarball found for ${pkgAtTag} in ${tmpDir}`);
      }
      if (matches.length > 1) {
        throw new Error(`ambiguous tarballs for ${pkgAtTag} in ${tmpDir}: ${matches.join(', ')}`);
      }
      return join(tmpDir, matches[0]);
    },
    catch: (error) => {
      return new CommandError({
        command: `find tarball ${tmpDir}/${prefix}*.tgz`,
        message: String(error),
      });
    },
  });
}

function installNpmTarball(
  pkg: string,
  dest: string,
  opts: { tag?: string } = {},
): Effect.Effect<void, CommandError> {
  const tag = opts.tag ?? 'latest';
  const shortName = pkg.replace('@maestria/', '');
  const prefix = `maestria-${shortName}-`;
  const pkgAtTag = `${pkg}@${tag}`;
  const tmpDir = tmpdir();
  return Effect.gen(function* () {
    yield* cleanupStaleTarball(tmpDir, prefix, dest);
    yield* run('npm', ['pack', pkgAtTag, '--pack-destination', tmpDir], 120_000);
    const tarballPath = yield* findPackedTarball(tmpDir, prefix, pkgAtTag);
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(dest, { recursive: true });
      },
      catch: (error) => {
        return new CommandError({ command: `mkdir -p ${dest}`, message: String(error) });
      },
    });
    yield* run('tar', ['-xzf', tarballPath, '-C', dest, '--strip-components=1'], 120_000);
    yield* Effect.tryPromise({
      try: async () => {
        const { unlink } = await import('node:fs/promises');
        await unlink(tarballPath);
      },
      catch: (error) => {
        return new CommandError({ command: `rm -f ${tarballPath}`, message: String(error) });
      },
    });
  });
}

const CLAUDE_MARKETPLACE_DIR = join(getMaestriaCacheDir(), 'claude-code-marketplace');
const CODEX_MARKETPLACE_DIR = join(getMaestriaCacheDir(), 'codex-marketplace');
const MAESTRIA_MARKETPLACE = 'maestria';
const MAESTRIA_PLUGIN = 'maestria';

type JsonRecord = Record<string, unknown>;

function jsonRecords(output: string, key?: string): JsonRecord[] {
  try {
    const parsed: unknown = JSON.parse(output);
    const value =
      key && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as JsonRecord)[key]
        : parsed;

    return Array.isArray(value)
      ? value.filter((entry): entry is JsonRecord => {
          return typeof entry === 'object' && entry !== null;
        })
      : [];
  } catch {
    return [];
  }
}

function hasMarketplace(output: string): boolean {
  return jsonRecords(output, 'marketplaces').some((marketplace) => {
    return marketplace.name === MAESTRIA_MARKETPLACE;
  });
}

function hasMaestriaPlugin(output: string): boolean {
  return jsonRecords(output, 'installed').some((plugin) => {
    const pluginId =
      typeof plugin.pluginId === 'string'
        ? plugin.pluginId
        : typeof plugin.id === 'string'
          ? plugin.id
          : '';
    const name = typeof plugin.name === 'string' ? plugin.name : '';
    const marketplaceName =
      typeof plugin.marketplaceName === 'string' ? plugin.marketplaceName : '';
    return (
      pluginId === `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}` ||
      (name === MAESTRIA_PLUGIN && marketplaceName === MAESTRIA_MARKETPLACE)
    );
  });
}

function installedMaestriaVersion(output: string): string {
  const plugin = jsonRecords(output, 'installed').find((entry) => {
    const pluginId =
      typeof entry.pluginId === 'string'
        ? entry.pluginId
        : typeof entry.id === 'string'
          ? entry.id
          : '';
    const name = typeof entry.name === 'string' ? entry.name : '';
    const marketplaceName = typeof entry.marketplaceName === 'string' ? entry.marketplaceName : '';
    return (
      pluginId === `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}` ||
      (name === MAESTRIA_PLUGIN && marketplaceName === MAESTRIA_MARKETPLACE)
    );
  });
  return typeof plugin?.version === 'string' ? plugin.version : 'unknown';
}

function hostPluginList(command: 'claude' | 'codex'): Effect.Effect<string, CommandError> {
  return Effect.suspend(() => {
    return run(command, ['plugin', 'list', '--json']);
  });
}

function prepareNpmMarketplace(
  pkg: string,
  marketplaceDir: string,
  marketplaceFile: string,
  manifest: JsonRecord,
): Effect.Effect<void, CommandError> {
  const pluginDir = `${marketplaceDir}/plugins/${MAESTRIA_PLUGIN}`;
  const marketplacePath = `${marketplaceDir}/${marketplaceFile}`;

  return Effect.gen(function* () {
    yield* installNpmTarball(pkg, pluginDir);
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir, writeFile } = await import('node:fs/promises');
        const { dirname } = await import('node:path');
        await mkdir(dirname(marketplacePath), { recursive: true });
        await writeFile(marketplacePath, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      catch: (error) => {
        return new CommandError({
          command: `write ${marketplacePath}`,
          message: String(error),
        });
      },
    });
  });
}


const claudeMarketplaceManifest: JsonRecord = {
  $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
  name: MAESTRIA_MARKETPLACE,
  owner: {
    name: 'Agustinus Nathaniel',
    url: 'https://github.com/agustinusnathaniel',
  },
  plugins: [
    {
      name: MAESTRIA_PLUGIN,
      displayName: 'Maestria',
      source: './plugins/maestria',
    },
  ],
};

const codexMarketplaceManifest: JsonRecord = {
  name: MAESTRIA_MARKETPLACE,
  interface: { displayName: 'Maestria' },
  plugins: [
    {
      name: MAESTRIA_PLUGIN,
      source: { source: 'local', path: './plugins/maestria' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
      category: 'Developer Tools',
    },
  ],
};

function ensureClaudeMarketplace(): Effect.Effect<void, CommandError> {
  return run('claude', ['plugin', 'marketplace', 'list', '--json']).pipe(
    Effect.flatMap((output) => {
      return hasMarketplace(output)
        ? Effect.void
        : run('claude', ['plugin', 'marketplace', 'add', CLAUDE_MARKETPLACE_DIR]).pipe(
            Effect.as(void 0),
          );
    }),
  );
}

function refreshClaudeMarketplace(): Effect.Effect<void, CommandError> {
  return run('claude', ['plugin', 'marketplace', 'update', MAESTRIA_MARKETPLACE]).pipe(
    Effect.as(void 0),
  );
}

function ensureCodexMarketplace(): Effect.Effect<void, CommandError> {
  return run('codex', ['plugin', 'marketplace', 'list', '--json']).pipe(
    Effect.flatMap((output) => {
      return hasMarketplace(output)
        ? Effect.void
        : run('codex', ['plugin', 'marketplace', 'add', CODEX_MARKETPLACE_DIR]).pipe(
            Effect.as(void 0),
          );
    }),
  );
}

// Codex plugin manifests do not declare custom agents or primary-session
// instructions. The published Maestria package carries native agent TOMLs and
// a managed AGENTS.md block as companion payloads, and the CLI owns copying
// them into Codex's documented locations.
const CODEX_MANAGED_AGENT_MANIFEST = '.maestria-agents.json';

interface CodexManagedAgentManifest {
  readonly version: 1;
  readonly files: readonly string[];
  readonly instructionsFile?: CodexGlobalInstructionFilename;
  readonly instructionsCreated?: boolean;
}

function codexHomePath(): string {
  return process.env.CODEX_HOME?.trim() || `${homedir()}/.codex`;
}

function codexManagedAgentDirectory(): string {
  return `${codexHomePath()}/agents`;
}

function codexManagedAgentManifestPath(): string {
  return `${codexHomePath()}/${CODEX_MANAGED_AGENT_MANIFEST}`;
}

function codexGlobalInstructionsPath(file: CodexGlobalInstructionFilename): string {
  return `${codexHomePath()}/${file}`;
}

function validateCodexManifestContent(parsed: Partial<CodexManagedAgentManifest>): void {
  if (parsed.version !== 1 || !Array.isArray(parsed.files)) {
    throw new Error(`invalid Maestria Codex agent manifest at ${codexManagedAgentManifestPath()}`);
  }
  if (
    !parsed.files.every((file) => {
      return typeof file === 'string' && /^[A-Za-z0-9_-]+\.toml$/.test(file);
    })
  ) {
    throw new Error(`invalid managed agent filename in ${codexManagedAgentManifestPath()}`);
  }
  if (
    parsed.instructionsFile !== undefined &&
    !CODEX_GLOBAL_INSTRUCTION_FILENAMES.includes(
      parsed.instructionsFile as CodexGlobalInstructionFilename,
    )
  ) {
    throw new Error(
      `invalid managed Codex instruction filename in ${codexManagedAgentManifestPath()}`,
    );
  }
  if (parsed.instructionsCreated !== undefined && typeof parsed.instructionsCreated !== 'boolean') {
    throw new Error(
      `invalid managed Codex instruction ownership in ${codexManagedAgentManifestPath()}`,
    );
  }
}

function readCodexManagedAgentManifest(): Effect.Effect<CodexManagedAgentManifest, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      let raw: string;
      try {
        raw = await readFile(codexManagedAgentManifestPath(), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { version: 1, files: [] } satisfies CodexManagedAgentManifest;
        }
        throw error;
      }
      const parsed = JSON.parse(raw) as Partial<CodexManagedAgentManifest>;
      validateCodexManifestContent(parsed);
      return {
        version: 1,
        files: parsed.files as string[],
        ...(parsed.instructionsFile !== undefined
          ? { instructionsFile: parsed.instructionsFile as CodexGlobalInstructionFilename }
          : {}),
        ...(parsed.instructionsCreated !== undefined
          ? { instructionsCreated: parsed.instructionsCreated }
          : {}),
      } satisfies CodexManagedAgentManifest;
    },
    catch: (error) => {
      return new CommandError({
        command: `read ${codexManagedAgentManifestPath()}`,
        message: String(error),
      });
    },
  });
}

function writeCodexManagedAgentManifest(
  manifest: CodexManagedAgentManifest,
): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { mkdir, rename, writeFile } = await import('node:fs/promises');
      await mkdir(codexHomePath(), { recursive: true });
      const path = codexManagedAgentManifestPath();
      const tempPath = `${path}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      await rename(tempPath, path);
    },
    catch: (error) => {
      return new CommandError({
        command: `write ${codexManagedAgentManifestPath()}`,
        message: String(error),
      });
    },
  });
}

// oxlint-disable-next-line max-lines-per-function -- installCodexManagedAgents is a single atomic Codex install transaction (read manifest, validate instructions, copy agent TOMLs with merge, clean stale files, sync global instructions). Splitting would obscure the required sequential ordering and create single-use helpers that hurt discoverability of the transaction flow. Cohesion is around one install operation.
export function installCodexManagedAgents(packageRoot: string): Effect.Effect<void, CommandError> {
  // oxlint-disable-next-line max-lines-per-function -- Effect.gen generator orchestrates the same atomic Codex transaction; splitting the generator would duplicate manifest/sourceFiles/targetDir closure and hide the linear install steps. Kept intact for cohesion.
  return Effect.gen(function* () {
    const manifest = yield* readCodexManagedAgentManifest();
    const sourceDir = `${packageRoot}/agents`;
    const targetDir = codexManagedAgentDirectory();
    const sourceFiles = MAESTRIA_AGENTS.map(codexManagedAgentFileName);
    const sourceInstructionsPath = `${packageRoot}/instructions/AGENTS.md`;

    const sourceInstructions = yield* Effect.tryPromise({
      try: async () => {
        const { readFile } = await import('node:fs/promises');
        return await readFile(sourceInstructionsPath, 'utf8');
      },
      catch: (error) => {
        return new Error(String(error));
      },
    });
    yield* Effect.tryPromise({
      try: async () => {
        if (!hasCodexManagedInstructions(sourceInstructions)) {
          throw new Error(`missing Maestria instruction markers in ${sourceInstructionsPath}`);
        }
      },
      catch: (error) => {
        return new Error(String(error));
      },
    });

    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir, readFile, rename, writeFile } = await import('node:fs/promises');
        await mkdir(targetDir, { recursive: true });
        for (let index = 0; index < sourceFiles.length; index++) {
          const file = sourceFiles[index]!;
          const agent = MAESTRIA_AGENTS[index]!;
          const sourcePath = `${sourceDir}/${file}`;
          const targetPath = `${targetDir}/${file}`;
          const bundled = await readFile(sourcePath, 'utf8');
          let next = bundled;
          for (const existingPath of [targetPath, `${targetDir}/${agent}.toml`]) {
            try {
              const existing = await readFile(existingPath, 'utf8');
              next = mergeCodexAgentSettings(bundled, existing);
              break;
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
              }
            }
          }
          const tempPath = `${targetPath}.tmp`;
          await writeFile(tempPath, next, 'utf8');
          await rename(tempPath, targetPath);
        }
      },
      catch: (error) => {
        return new Error(String(error));
      },
    });

    const currentFiles = new Set(sourceFiles);
    yield* Effect.tryPromise({
      try: async () => {
        const { rm } = await import('node:fs/promises');
        for (const file of manifest.files) {
          if (!currentFiles.has(file)) {
            await rm(`${targetDir}/${file}`, { force: true });
          }
        }
      },
      catch: (error) => {
        return new Error(String(error));
      },
    });

    const instructionState = yield* Effect.tryPromise({
      // oxlint-disable-next-line max-lines-per-function -- instruction sync is a cohesive atomic sequence: read existing global instruction files, determine target file, clean managed blocks, and atomically write the managed block. Splitting would fragment the file-selection and cleanup logic that shares existing/cleaned maps and manifest state.
      try: async () => {
        const { mkdir, readFile, rename, rm, writeFile } = await import('node:fs/promises');
        const existing = new Map<CodexGlobalInstructionFilename, string | undefined>();
        for (const file of CODEX_GLOBAL_INSTRUCTION_FILENAMES) {
          try {
            existing.set(file, await readFile(codexGlobalInstructionsPath(file), 'utf8'));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              existing.set(file, undefined);
            } else {
              throw error;
            }
          }
        }

        const sourceBlock = sourceInstructions;
        const managedFiles = CODEX_GLOBAL_INSTRUCTION_FILENAMES.filter((file) => {
          const content = existing.get(file);
          return content !== undefined && hasCodexManagedInstructions(content);
        });
        const override = existing.get('AGENTS.override.md');
        const previousFile = manifest.instructionsFile;
        const target =
          override?.trim() && !managedFiles.includes('AGENTS.override.md')
            ? 'AGENTS.override.md'
            : previousFile && managedFiles.includes(previousFile)
              ? previousFile
              : (managedFiles[0] ?? (override?.trim() ? 'AGENTS.override.md' : 'AGENTS.md'));

        const cleaned = new Map<CodexGlobalInstructionFilename, string | undefined>();
        for (const file of CODEX_GLOBAL_INSTRUCTION_FILENAMES) {
          const content = existing.get(file);
          cleaned.set(
            file,
            content === undefined ? undefined : removeCodexManagedInstructions(content),
          );
        }

        const targetContent = upsertCodexManagedInstructions(
          cleaned.get(target) ?? '',
          sourceBlock,
        );
        const writeAtomic = async (path: string, content: string): Promise<void> => {
          await mkdir(codexHomePath(), { recursive: true });
          const tempPath = `${path}.tmp`;
          await writeFile(tempPath, content, 'utf8');
          await rename(tempPath, path);
        };

        for (const file of CODEX_GLOBAL_INSTRUCTION_FILENAMES) {
          if (file === target) {
            await writeAtomic(codexGlobalInstructionsPath(file), targetContent);
            continue;
          }
          const original = existing.get(file);
          const next = cleaned.get(file);
          if (original === undefined || next === undefined || next === original) {
            continue;
          }
          if (
            next.length === 0 &&
            manifest.instructionsCreated &&
            manifest.instructionsFile === file
          ) {
            await rm(codexGlobalInstructionsPath(file), { force: true });
          } else {
            await writeAtomic(codexGlobalInstructionsPath(file), next);
          }
        }

        return {
          file: target,
          created:
            existing.get(target) === undefined ||
            (manifest.instructionsCreated === true && manifest.instructionsFile === target),
        } satisfies {
          file: CodexGlobalInstructionFilename;
          created: boolean;
        };
      },
      catch: (error) => {
        return new Error(String(error));
      },
    });

    yield* writeCodexManagedAgentManifest({
      version: 1,
      files: sourceFiles,
      instructionsFile: instructionState.file,
      instructionsCreated: instructionState.created,
    });
  }).pipe(
    Effect.mapError((error) => {
      return new CommandError({
        command: `install Codex native agents from ${packageRoot}`,
        message: error instanceof CommandError ? error.message : String(error),
      });
    }),
  );
}

export function removeCodexManagedAgents(): Effect.Effect<void, CommandError> {
  return Effect.gen(function* () {
    const manifest = yield* readCodexManagedAgentManifest();
    yield* Effect.tryPromise({
      try: async () => {
        const { readFile, rm } = await import('node:fs/promises');
        for (const file of manifest.files) {
          await rm(`${codexManagedAgentDirectory()}/${file}`, { force: true });
        }

        for (const file of CODEX_GLOBAL_INSTRUCTION_FILENAMES) {
          const path = codexGlobalInstructionsPath(file);
          let content: string;
          try {
            content = await readFile(path, 'utf8');
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              continue;
            }
            throw error;
          }
          const next = removeCodexManagedInstructions(content);
          if (next === content) {
            continue;
          }
          if (
            next.length === 0 &&
            manifest.instructionsCreated &&
            manifest.instructionsFile === file
          ) {
            await rm(path, { force: true });
          } else {
            const { rename, writeFile } = await import('node:fs/promises');
            const tempPath = `${path}.tmp`;
            await writeFile(tempPath, next, 'utf8');
            await rename(tempPath, path);
          }
        }
        await rm(codexManagedAgentManifestPath(), { force: true });
      },
      catch: (error) => {
        return new CommandError({
          command: `remove Codex native agents from ${codexManagedAgentDirectory()}`,
          message: String(error),
        });
      },
    });
  });
}

// ── Platform ID literal registry ─────────────────────

/**
 * Literal-typed registry of platform IDs. This is the single source for the
 * platform ID union - PlatformHandler.id and ValidPlatform both derive from it,
 * so adding or removing a platform updates the type without an independent cast.
 */
export const PLATFORM_IDS = [
  'opencode',
  'omp',
  'pi',
  'prime-agent',
  'kimi-code',
  'hermes',
  'cursor',
  'claude-code',
  'codex',
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

// ── Platform definitions ─────────────────────────────

/**
 * Per-update host state that a handler captures exactly once so the update
 * command's version check, preflight, and update step can share a single host
 * inspection instead of running it once per step. Handlers that need no shared
 * state (every handler except Prime Agent) omit `captureUpdateSnapshot`.
 */
export interface PlatformUpdateSnapshot {
  /** Installed version observed when the snapshot was captured. */
  readonly installedVersion: string;
  /**
   * Prime Agent: the version-pinned user-scope source registration (e.g.
   * `npm:@maestria/prime-agent@0.2.0`) when the registration is pinned. Prime
   * skips `package update` for pinned registrations, so the update flow fails
   * with an accurate error instead of claiming a successful update. Unset for
   * unpinned registrations.
   */
  readonly pinnedSource?: string;
}

export interface PlatformHandler {
  readonly id: PlatformId;
  readonly label: string;
  readonly npmPackage?: string;
  readonly detect: Effect.Effect<boolean, never>;
  readonly isInstalled: Effect.Effect<boolean, never>;
  readonly getInstalledVersion: Effect.Effect<string, CommandError>;
  readonly getLatestVersion: Effect.Effect<string, never>;
  /** Whether `update --version` can select an exact package version. */
  readonly supportsVersionPinning?: boolean;
  /**
   * Optional single-capture per-update snapshot. When present, the update
   * command captures it once and uses it for the installed-version check, the
   * preflight, and the update itself, so a stateful host inspection (e.g.
   * Prime's `package list`) runs a single time per update. A capture failure
   * fails the update with the accurate error rather than updating blind.
   */
  readonly captureUpdateSnapshot?: Effect.Effect<PlatformUpdateSnapshot, CommandError>;
  /**
   * Optional update eligibility/preflight check, run by the update command
   * before the version-equality "Already up to date" short-circuit so an
   * ineligible registration can never be reported as a successful no-op. It
   * receives the per-update snapshot when the handler captured one. Fails with
   * a CommandError to block the update with an accurate message (e.g. Prime's
   * version-pinned registration check, which Prime itself skips for
   * `package update`). Handlers without such a condition omit it.
   */
  readonly preflightUpdate?: (
    snapshot?: PlatformUpdateSnapshot,
  ) => Effect.Effect<void, CommandError>;
  readonly install: Effect.Effect<void, CommandError>;
  readonly update: (
    version?: string,
    snapshot?: PlatformUpdateSnapshot,
  ) => Effect.Effect<void, CommandError>;
  readonly uninstall: Effect.Effect<void, CommandError>;
}

function clearOpencodeCache(): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readdir, rm } = await import('node:fs/promises');
      const base = join(getCacheDir(), 'opencode', 'packages', '@maestria');
      let entries: string[];
      try {
        entries = await readdir(base);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return;
        }
        throw error;
      }
      const stale = entries.filter((e) => {
        return e.startsWith('opencode');
      });
      await Promise.all(
        stale.map((e) => {
          return rm(`${base}/${e}`, { recursive: true, force: true });
        }),
      );
    },
    catch: (error) => {
      return new CommandError({
        command: `clear opencode cache ${join(getCacheDir(), 'opencode', 'packages', '@maestria', 'opencode*')}`,
        message: String(error),
      });
    },
  });
}

const opencode: PlatformHandler = {
  id: 'opencode',
  label: 'OpenCode',
  npmPackage: '@maestria/opencode',

  detect: commandExists('opencode'),

  isInstalled: readOpenCodeConfig().pipe(
    Effect.map((out) => {
      return out.includes('@maestria/opencode');
    }),
    Effect.catchCause(() => {
      return Effect.succeed(false);
    }),
  ),

  getInstalledVersion: readOpenCodeConfig().pipe(
    Effect.map((config) => {
      const match = config.match(/@maestria\/opencode@(.+?)"/);
      return match?.[1] ?? null;
    }),
    Effect.flatMap((specifier) => {
      if (!specifier) {
        return Effect.succeed('unknown');
      }
      return readTextFile(
        join(
          getCacheDir(),
          'opencode',
          'packages',
          `@maestria/opencode@${specifier}`,
          'node_modules',
          '@maestria',
          'opencode',
          'package.json',
        ),
      ).pipe(
        Effect.map((out) => {
          try {
            const pkg: { version?: string } = JSON.parse(out);
            return pkg.version ?? 'unknown';
          } catch {
            return 'unknown';
          }
        }),
      );
    }),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/opencode'),

  install: Effect.gen(function* () {
    yield* clearOpencodeCache();
    // Install globally by default - install is a setup command, not per-project
    yield* run('opencode', ['plugin', '@maestria/opencode@latest', '-g'], 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) => {
    return Effect.gen(function* () {
      const tag = version ?? 'latest';

      yield* clearOpencodeCache();

      // Check if installed globally or at project level
      const globalConfig = yield* readOpenCodeConfig().pipe(
        Effect.map((out) => {
          return out.includes('@maestria/opencode');
        }),
        Effect.catchCause(() => {
          return Effect.succeed(false);
        }),
      );
      const flag = globalConfig ? ['-g', '--force'] : ['--force'];
      yield* run('opencode', ['plugin', `@maestria/opencode@${tag}`, ...flag]);
    });
  },

  uninstall: Effect.sync(() => {
    console.log(
      `\n  To uninstall OpenCode:\n` +
        `  1. Edit ~/.config/opencode/opencode.jsonc (or .opencode/opencode.jsonc in your project)\n` +
        `  2. Remove "@maestria/opencode@latest" from the "plugin" array\n` +
        `  3. Optionally clear cache: rm -rf ${join(getCacheDir(), 'opencode', 'packages', '@maestria', 'opencode*')}\n`,
    );
  }),
};

const claudeCode: PlatformHandler = {
  id: 'claude-code',
  label: 'Claude Code',
  npmPackage: '@maestria/claude-code',
  supportsVersionPinning: false,

  detect: commandExists('claude'),

  isInstalled: hostPluginList('claude').pipe(
    Effect.map(hasMaestriaPlugin),
    Effect.catchCause(() => {
      return Effect.succeed(false);
    }),
  ),

  getInstalledVersion: hostPluginList('claude').pipe(
    Effect.map(installedMaestriaVersion),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/claude-code'),

  install: Effect.gen(function* () {
    yield* prepareNpmMarketplace(
      '@maestria/claude-code',
      CLAUDE_MARKETPLACE_DIR,
      '.claude-plugin/marketplace.json',
      claudeMarketplaceManifest,
    );
    yield* ensureClaudeMarketplace();
    yield* refreshClaudeMarketplace();
    yield* run('claude', [
      'plugin',
      'install',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--scope',
      'user',
    ]);
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) => {
    return Effect.gen(function* () {
      yield* prepareNpmMarketplace(
        '@maestria/claude-code',
        CLAUDE_MARKETPLACE_DIR,
        '.claude-plugin/marketplace.json',
        claudeMarketplaceManifest,
      );
      yield* ensureClaudeMarketplace();
      yield* refreshClaudeMarketplace();
      yield* run('claude', [
        'plugin',
        'update',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--scope',
        'user',
      ]);
    });
  },

  uninstall: Effect.suspend(() => {
    return run('claude', [
      'plugin',
      'uninstall',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--scope',
      'user',
      '--yes',
    ]);
  }).pipe(Effect.as(void 0)),
};

const codex: PlatformHandler = {
  id: 'codex',
  label: 'Codex CLI',
  npmPackage: '@maestria/codex',
  supportsVersionPinning: false,

  detect: commandExists('codex'),

  isInstalled: hostPluginList('codex').pipe(
    Effect.map(hasMaestriaPlugin),
    Effect.catchCause(() => {
      return Effect.succeed(false);
    }),
  ),

  getInstalledVersion: hostPluginList('codex').pipe(
    Effect.map(installedMaestriaVersion),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/codex'),

  install: Effect.gen(function* () {
    yield* prepareNpmMarketplace(
      '@maestria/codex',
      CODEX_MARKETPLACE_DIR,
      '.agents/plugins/marketplace.json',
      codexMarketplaceManifest,
    );
    yield* ensureCodexMarketplace();
    yield* run('codex', ['plugin', 'add', `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`, '--json']);
    yield* installCodexManagedAgents(`${CODEX_MARKETPLACE_DIR}/plugins/${MAESTRIA_PLUGIN}`);
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) => {
    return Effect.gen(function* () {
      yield* prepareNpmMarketplace(
        '@maestria/codex',
        CODEX_MARKETPLACE_DIR,
        '.agents/plugins/marketplace.json',
        codexMarketplaceManifest,
      );
      yield* ensureCodexMarketplace();
      // Codex CLI has no plugin update command. Reinstalling after refreshing
      // the marketplace is its supported update path.
      yield* run('codex', [
        'plugin',
        'remove',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--json',
      ]);
      yield* run('codex', [
        'plugin',
        'add',
        `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
        '--json',
      ]);
      yield* installCodexManagedAgents(`${CODEX_MARKETPLACE_DIR}/plugins/${MAESTRIA_PLUGIN}`);
    });
  },

  uninstall: Effect.gen(function* () {
    yield* run('codex', [
      'plugin',
      'remove',
      `${MAESTRIA_PLUGIN}@${MAESTRIA_MARKETPLACE}`,
      '--json',
    ]);
    yield* removeCodexManagedAgents();
  }).pipe(Effect.as(void 0)),
};

const pi: PlatformHandler = {
  id: 'pi',
  label: 'Pi',
  npmPackage: '@maestria/pi',

  detect: commandExists('pi'),

  isInstalled: fileExists(`${homedir()}/.pi/agent/npm/node_modules/@maestria/pi/package.json`),

  getInstalledVersion: readTextFile(
    `${homedir()}/.pi/agent/npm/node_modules/@maestria/pi/package.json`,
  ).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/pi'),

  install: Effect.gen(function* () {
    // Install prerequisite: @gotgenes/pi-subagents for subagent dispatch
    yield* run('pi', ['install', 'npm:@gotgenes/pi-subagents'], 60_000).pipe(
      Effect.catchCause(() => {
        return Effect.void;
      }),
    );
    // Install main package
    yield* run('pi', ['install', 'npm:@maestria/pi'], 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) => {
    return Effect.gen(function* () {
      const tagged = version ? `npm:@maestria/pi@${version}` : 'npm:@maestria/pi@latest';
      // Ensure pi-subagents is installed (may not be for users who installed before v0.4.1)
      yield* run('pi', ['install', 'npm:@gotgenes/pi-subagents'], 60_000).pipe(
        Effect.catchCause(() => {
          return Effect.void;
        }),
      );
      yield* run('pi', ['install', tagged], 120_000);
    });
  },

  uninstall: run('pi', ['uninstall', 'npm:@maestria/pi']).pipe(Effect.as(void 0)),
};

// Prime Agent is Pi rebranded: the Prime fork of @earendil-works/pi-coding-agent
// (config dir `.prime/agent`, binary `prime-agent`). Packages are registered via
// `prime-agent package install/update/remove npm:@maestria/prime-agent`; by
// default (no --local flag) install/remove write to global settings
// (`~/.prime/agent/settings.json`). The CLI has no scope parameter, so this
// handler manages the documented global (user) scope only.
//
// Scope isolation: Prime's package commands resolve project settings from the
// current working directory (`package update` scans both user and project
// settings based on cwd), so every Prime command here runs from a freshly
// created empty temporary directory (see withPrimeTempCwd). From that isolated
// cwd only the user (global) scope is visible: a project's registrations are
// never scanned, counted, or modified, and Prime settings files are never
// edited directly. Temp-cwd creation fails closed with a CommandError and the
// directory is removed on both success and failure.
//
// Detection reads `prime-agent package list`, which prints configured package
// sources grouped by scope: a "User packages:" section (global settings) and a
// "Project packages:" section (project settings). Only the user section is
// managed here; project-only registrations must not count as installed because
// install/update/remove target the default global scope. Each entry is one
// source line (optionally suffixed with `(filtered)`) followed by its own
// indented installed-path line when the package is installed. The version is
// read from that entry's installed path package.json via Node's cross-platform
// fs/promises API (not a POSIX `cat`), so Windows-style installed paths resolve
// on Windows hosts.
//
// Updates: Prime's `package update <source>` accepts no version spec and
// versioned/pinned specs are skipped by updates, so exact version pinning is
// not exposed (supportsVersionPinning: false). A normal update captures the
// registration state once per update (captureUpdateSnapshot), reusing that
// single `package list` for the installed-version check, the preflight, and
// the update step; the preflight detects a version-pinned user registration
// before the update command's "Already up to date" short-circuit and reports
// an accurate error instead of claiming a successful update or invalidating
// the CLI version cache. The same per-update snapshot also means a user
// unpinned + project pinned mix updates only the user registration - the
// project pin is never consulted (only the user scope is parsed, and commands
// run from an isolated cwd where no project settings exist).
//
// Binary detection uses the shared commandExists helper, which probes via the
// POSIX `which` command. The repository has no cross-platform executable lookup
// abstraction, and every platform handler shares this helper, so Prime
// detection inherits that existing shared behavior; full Windows support for
// executable detection is not claimed here. Installed-path parsing and version
// reads above are cross-platform.
const PRIME_MAESTRIA_SOURCE = 'npm:@maestria/prime-agent';

/**
 * Match a configured `@maestria/prime-agent` npm source line as printed by
 * `prime-agent package list`, including the optional npm version/ref suffix
 * (e.g. `npm:@maestria/prime-agent@0.2.0`) and the optional `(filtered)`
 * marker. Prime installs npm packages by name, so a versioned source resolves
 * to the same installed path as the unversioned one.
 */
const PRIME_MAESTRIA_SOURCE_RE = /^\s*npm:@maestria\/prime-agent(?:@\S+)?(?:\s+\(filtered\))?\s*$/;

/**
 * Match a version-pinned npm source registration, i.e. one with an explicit
 * @version/ref suffix (e.g. `npm:@maestria/prime-agent@0.2.0`). Prime skips
 * `package update` for pinned registrations, so the CLI must not report a
 * successful update for them.
 */
const PRIME_MAESTRIA_PINNED_RE = /^npm:@maestria\/prime-agent@\S+(?:\s+\(filtered\))?$/;

/**
 * ANSI SGR escape sequence matcher, used to strip bold/dim styling from
 * `prime-agent package list` section headers and installed-path lines. The
 * ESC byte is produced via String.fromCharCode so no control character is
 * embedded in the source (eslint no-control-regex).
 */
const ANSI_SGR_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/**
 * Extract the user (global) scope section of `prime-agent package list`
 * output. Prime prints a "User packages:" section followed by a "Project
 * packages:" section; only the user section is managed by this CLI. Section
 * headers are styled bold when printed to a TTY, so ANSI codes are stripped
 * before matching. Returns [] when no user section is present.
 */
function primeUserScopeLines(output: string): string[] {
  const lines = output.replace(ANSI_SGR_RE, '').split('\n');
  const start = lines.findIndex((line) => {
    return /^\s*user\s+packages:\s*$/i.test(line);
  });
  if (start === -1) {
    return [];
  }
  const end = lines.findIndex((line, index) => {
    return index > start && /^\s*project\s+packages:\s*$/i.test(line);
  });
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** True when the user-scope section of `package list` contains our source. */
function hasPrimeMaestriaPackage(output: string): boolean {
  return primeUserScopeLines(output).some((line) => {
    return PRIME_MAESTRIA_SOURCE_RE.test(line);
  });
}

/**
 * Return the user-scope maestria source line when it is version-pinned (e.g.
 * `npm:@maestria/prime-agent@0.2.0`), or undefined when the registration is
 * unpinned or absent. Prime skips `package update` for pinned registrations,
 * so the update flow must fail with an accurate message instead of claiming an
 * update happened.
 */
function primeMaestriaPinnedSource(output: string): string | undefined {
  const source = primeUserScopeLines(output).find((line) => {
    return PRIME_MAESTRIA_SOURCE_RE.test(line);
  });
  const trimmed = source?.trim();
  return trimmed && PRIME_MAESTRIA_PINNED_RE.test(trimmed) ? trimmed : undefined;
}

/**
 * Read a package.json file and return its `version` field using Node's
 * cross-platform fs/promises API rather than a POSIX `cat`, so installed paths
 * in either host-native or Windows format work on the matching host. A
 * Windows-style path on a POSIX host (or a missing file) fails to read and
 * falls back to 'unknown' in the caller. Fails with a CommandError to keep the
 * Effect error conventions used by the platform handlers.
 */
export function readPackageJsonVersion(
  packageJsonPath: string,
): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      const pkg: { version?: string } = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      return pkg.version ?? 'unknown';
    },
    catch: (error) => {
      return new CommandError({
        command: `read ${packageJsonPath}`,
        message: String(error),
      });
    },
  });
}

/**
 * True when a path is absolute per either the host platform or Windows
 * conventions. `prime-agent package list` prints installed package paths in
 * the host's native format (`/home/user/...` on POSIX, `C:\Users\...` on
 * Windows), so the version lookup must accept both forms. On a POSIX host a
 * Windows-style path fails the subsequent fs read and falls back to 'unknown',
 * preserving prior behavior; on a Windows host the same read succeeds.
 */
function isPrimeAbsolutePath(p: string): boolean {
  return isAbsolute(p) || win32.isAbsolute(p);
}

/**
 * Read the installed version from `prime-agent package list` output. Only the
 * user-scope section is considered (project registrations are not managed
 * here), and only the path line printed directly below our source line is
 * used - later absolute paths belong to subsequent package entries. Falls back
 * to 'unknown' when the package is not listed, its entry has no installed
 * path, or the installed package.json cannot be read.
 */
function primeMaestriaInstalledVersion(output: string): Effect.Effect<string, CommandError> {
  const lines = primeUserScopeLines(output);
  const sourceIndex = lines.findIndex((line) => {
    return PRIME_MAESTRIA_SOURCE_RE.test(line);
  });
  if (sourceIndex === -1) {
    return Effect.succeed('unknown');
  }

  const installedPath = lines[sourceIndex + 1]?.trim();
  if (!installedPath || !isPrimeAbsolutePath(installedPath)) {
    return Effect.succeed('unknown');
  }

  return readPackageJsonVersion(`${installedPath}/package.json`).pipe(
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  );
}

/**
 * Create a fresh empty temporary working directory for Prime Agent package
 * commands. Prime's `package list`/`update` resolve project settings from the
 * current working directory, so every Prime command runs from an isolated
 * empty directory: only the user (global) scope can be read or written, and a
 * project's registrations are never scanned or modified. Fails closed with a
 * CommandError when the directory cannot be created, blocking the operation
 * before any Prime command runs.
 */
function primeTempCwd(): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { mkdtemp } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      return await mkdtemp(join(tmpdir(), 'maestria-prime-'));
    },
    catch: (error) => {
      return new CommandError({
        command: `create isolated temp cwd (${tmpdir()}/maestria-prime-*)`,
        message: `Failed to create an isolated working directory for Prime Agent: ${String(error)}`,
      });
    },
  });
}

/** Remove a Prime Agent temp cwd. Best-effort: cleanup failures are ignored. */
function removePrimeTempCwd(dir: string): Effect.Effect<void, never> {
  return Effect.tryPromise({
    try: async () => {
      const { rm } = await import('node:fs/promises');
      await rm(dir, { recursive: true, force: true });
    },
    catch: () => {},
  }).pipe(
    Effect.catchCause(() => {
      return Effect.void;
    }),
  );
}

/**
 * Run a Prime Agent package command from a freshly created empty temporary
 * working directory. The directory is removed after the command completes on
 * both success and failure (Effect.ensuring), and temp-cwd creation failures
 * fail closed with a CommandError before the command runs.
 */
function withPrimeTempCwd<T>(
  effect: (cwd: string) => Effect.Effect<T, CommandError>,
): Effect.Effect<T, CommandError> {
  return Effect.gen(function* () {
    const cwd = yield* primeTempCwd();
    return yield* effect(cwd).pipe(Effect.ensuring(removePrimeTempCwd(cwd)));
  });
}

/**
 * `prime-agent package list` output, read from an isolated empty temp cwd so
 * project settings are never consulted. Shared by detection, version reads,
 * and the per-update snapshot; the update flow captures it once per update.
 */
const primePackageList: Effect.Effect<string, CommandError> = withPrimeTempCwd((cwd) => {
  return run('prime-agent', ['package', 'list'], 120_000, cwd);
});

/**
 * Capture the per-update registration snapshot: one `prime-agent package list`
 * read whose parsed installed version and pinned-source state are reused by
 * the update command's version check, preflight, and update step.
 */
function primeUpdateSnapshot(): Effect.Effect<PlatformUpdateSnapshot, CommandError> {
  return Effect.gen(function* () {
    const list = yield* primePackageList;
    return {
      installedVersion: yield* primeMaestriaInstalledVersion(list),
      pinnedSource: primeMaestriaPinnedSource(list),
    };
  });
}

/**
 * Update preflight for Prime Agent. Fails with a CommandError when the
 * user-scope maestria registration is version-pinned, because Prime skips
 * `package update` for pinned registrations. When a per-update snapshot is
 * available it is used (no extra `package list`); otherwise the registration
 * state is read now, so a direct handler call fails closed for a pinned
 * registration too. The update command runs this before its "Already up to
 * date" short-circuit, so a pinned registration can never be reported as a
 * successful no-op update.
 */
function primeUpdatePreflight(
  snapshot?: PlatformUpdateSnapshot,
): Effect.Effect<void, CommandError> {
  return Effect.gen(function* () {
    // A captured snapshot already knows the pinned state (pinned or not); only
    // a direct call without a snapshot (e.g. invoking the handler's update in
    // isolation) needs to read the registration state now.
    const pinnedSource =
      snapshot !== undefined
        ? snapshot.pinnedSource
        : yield* primePackageList.pipe(Effect.map(primeMaestriaPinnedSource));
    if (pinnedSource) {
      yield* Effect.fail(
        new CommandError({
          command: `prime-agent package update ${PRIME_MAESTRIA_SOURCE}`,
          message:
            `Prime Agent package registration is version-pinned (${pinnedSource}); ` +
            'Prime skips updates for pinned registrations. Remove the version ' +
            'from the registration to update to latest.',
        }),
      );
    }
  }).pipe(Effect.as(void 0));
}

const primeAgent: PlatformHandler = {
  id: 'prime-agent',
  label: 'Prime Agent',
  npmPackage: '@maestria/prime-agent',
  supportsVersionPinning: false,

  detect: commandExists('prime-agent'),

  isInstalled: primePackageList.pipe(
    Effect.map(hasPrimeMaestriaPackage),
    Effect.catchCause(() => {
      return Effect.succeed(false);
    }),
  ),

  getInstalledVersion: primePackageList.pipe(
    Effect.flatMap(primeMaestriaInstalledVersion),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/prime-agent'),

  // One per-update inspection shared by the version check, the preflight, and
  // the update step, so a normal update lists registrations once before and
  // once after the update command instead of once per step.
  captureUpdateSnapshot: primeUpdateSnapshot(),

  // Runs before the update command's "Already up to date" short-circuit so a
  // version-pinned registration is reported as an error even when the
  // installed version already equals the latest.
  preflightUpdate: (snapshot?: PlatformUpdateSnapshot) => {
    return primeUpdatePreflight(snapshot);
  },

  install: withPrimeTempCwd((cwd) => {
    return run('prime-agent', ['package', 'install', PRIME_MAESTRIA_SOURCE], 120_000, cwd);
  }).pipe(Effect.as(void 0)),

  update: (_version?: string, snapshot?: PlatformUpdateSnapshot) => {
    return Effect.gen(function* () {
      // Prime skips `package update` for version-pinned registrations. Detect
      // that state up front (from the per-update snapshot when available) and
      // fail with an accurate message rather than reporting a fake success
      // (which would also invalidate the version cache for a package that was
      // not updated).
      yield* primeUpdatePreflight(snapshot);
      yield* withPrimeTempCwd((cwd) => {
        return run('prime-agent', ['package', 'update', PRIME_MAESTRIA_SOURCE], 120_000, cwd);
      });
    }).pipe(Effect.as(void 0));
  },

  uninstall: withPrimeTempCwd((cwd) => {
    return run('prime-agent', ['package', 'remove', PRIME_MAESTRIA_SOURCE], 60_000, cwd);
  }).pipe(Effect.as(void 0)),
};

const kimiCode: PlatformHandler = {
  id: 'kimi-code',
  label: 'Kimi Code',
  npmPackage: '@maestria/kimi-code',

  detect: Effect.gen(function* () {
    if (yield* commandExists('kimi')) {
      return true;
    }
    const hasRegistry = yield* fileExists(kimiInstalledPath());
    if (hasRegistry) {
      return true;
    }
    return yield* fileExists(`${kimiCodeHome()}/config.toml`);
  }),

  isInstalled: readKimiInstalled().pipe(
    Effect.map((file) => {
      return file.plugins.some((plugin) => {
        return plugin.id === MAESTRIA_PLUGIN;
      });
    }),
    Effect.flatMap((installed) => {
      return installed
        ? Effect.succeed(true)
        : fileExists(`${kimiManagedPluginDir()}/kimi.plugin.json`);
    }),
    Effect.catchCause(() => {
      return Effect.succeed(false);
    }),
  ),

  getInstalledVersion: Effect.suspend(() => {
    return readTextFile(`${kimiManagedPluginDir()}/kimi.plugin.json`).pipe(
      Effect.map((out: string) => {
        try {
          return JSON.parse(out).version ?? 'unknown';
        } catch {
          return 'unknown';
        }
      }),
      Effect.catchCause(() => {
        return Effect.succeed('unknown');
      }),
    );
  }),

  getLatestVersion: npmViewVersion('@maestria/kimi-code'),

  install: Effect.gen(function* () {
    // Validate the host registry before the tarball helper replaces the managed
    // directory. Kimi's plugin manager treats malformed installed.json as a
    // load failure, so do not destroy the current copy before surfacing it.
    yield* readKimiInstalled();
    yield* installNpmTarball('@maestria/kimi-code', kimiManagedPluginDir());
    yield* registerKimiPlugin();
  }).pipe(Effect.as(void 0)),

  update: (version?: string) => {
    return Effect.gen(function* () {
      const tag = version ?? 'latest';
      yield* readKimiInstalled();
      yield* installNpmTarball('@maestria/kimi-code', kimiManagedPluginDir(), { tag });
      yield* registerKimiPlugin();
      yield* invalidateVersionCache('@maestria/kimi-code').pipe(
        Effect.catchCause(() => {
          return Effect.void;
        }),
      );
    }).pipe(Effect.as(void 0));
  },

  uninstall: removeKimiPlugin().pipe(Effect.as(void 0)),
};

const hermes: PlatformHandler = {
  id: 'hermes',
  label: 'Hermes',
  // No npmPackage - distributed via hermes plugins install (git-based)

  detect: commandExists('hermes'),

  isInstalled: fileExists(`${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`),

  getInstalledVersion: readTextFile(
    `${homedir()}/.hermes/plugins/maestria-hermes/plugin.yaml`,
  ).pipe(
    Effect.map((out: string) => {
      const match = out.match(/^version:\s*["']?(.+?)["']?\s*$/m);
      return match?.[1] ?? 'unknown';
    }),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: Effect.succeed('see GitHub releases'),

  install: Effect.gen(function* () {
    yield* run(
      'hermes',
      ['plugins', 'install', 'agustinusnathaniel/maestria/packages/hermes', '--enable'],
      120_000,
    );
  }).pipe(Effect.as(void 0)),

  update: (_version?: string) => {
    return Effect.gen(function* () {
      if (_version) {
        console.log(
          `  ${picocolors.yellow('⚠')} Version pinning is not supported for git-based Hermes plugins. ` +
            `Updating to latest from git.`,
        );
      }
      yield* run('hermes', ['plugins', 'update', 'maestria-hermes'], 60_000);
    });
  },

  uninstall: Effect.gen(function* () {
    yield* run('hermes', ['plugins', 'remove', 'maestria-hermes'], 15_000);
  }).pipe(Effect.as(void 0)),
};

const CURSOR_PLUGIN_DIR = `${homedir()}/.cursor/plugins/local/maestria`;
const CURSOR_PLUGIN_JSON = `${CURSOR_PLUGIN_DIR}/.cursor-plugin/plugin.json`;
const CURSOR_AGENT_NAMES = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;

function cursorCliName(): Effect.Effect<string | undefined, never> {
  return Effect.gen(function* () {
    if (yield* commandExists('cursor-agent')) {
      return 'cursor-agent';
    }
    if (!(yield* commandExists('agent'))) {
      return undefined;
    }

    const version = yield* run('agent', ['--version'], 3_000).pipe(
      Effect.catchCause(() => {
        return Effect.succeed('');
      }),
    );
    return /cursor/i.test(version) ? 'agent' : undefined;
  });
}

function parseCursorAgentModel(content: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
  if (frontmatter === undefined) {
    return undefined;
  }
  const match = /^model:\s*(?:"([^"]*)"|'([^']*)'|(.+?))\s*$/m.exec(frontmatter);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function setCursorAgentModel(content: string, model: string): string {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n)?)/.exec(content);
  if (!match) {
    return content;
  }
  const [, opening, body, closing] = match;
  if (opening === undefined || body === undefined || closing === undefined) {
    return content;
  }

  const lines = body.split(/\r?\n/);
  const modelIndex = lines.findIndex((line) => {
    return /^model:\s*/.test(line);
  });
  if (model) {
    const rendered = `model: ${model}`;
    if (modelIndex >= 0) {
      lines[modelIndex] = rendered;
    } else {
      lines.push(rendered);
    }
  } else if (modelIndex >= 0) {
    lines.splice(modelIndex, 1);
  }
  return `${opening}${lines.join('\n')}${closing}${content.slice(match[0].length)}`;
}

/** Capture configured Cursor plugin-agent models before a package update replaces the plugin. */
function readCursorAgentModels(): Effect.Effect<Record<string, string>, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      const result: Record<string, string> = {};
      for (const agent of CURSOR_AGENT_NAMES) {
        try {
          const content = await readFile(`${CURSOR_PLUGIN_DIR}/agents/${agent}.md`, 'utf8');
          const model = parseCursorAgentModel(content);
          if (model) {
            result[agent] = model;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }
      return result;
    },
    catch: (error) => {
      return new CommandError({
        command: `read Cursor agent models from ${CURSOR_PLUGIN_DIR}/agents`,
        message: String(error),
      });
    },
  });
}

/** Reapply configured Cursor plugin-agent models after replacing the generated package files. */
function restoreCursorAgentModels(
  models: Record<string, string>,
): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { mkdir, readFile, writeFile } = await import('node:fs/promises');
      const agentDir = `${CURSOR_PLUGIN_DIR}/agents`;
      await mkdir(agentDir, { recursive: true });
      for (const [agent, model] of Object.entries(models)) {
        const path = `${agentDir}/${agent}.md`;
        const content = await readFile(path, 'utf8');
        await writeFile(path, setCursorAgentModel(content, model), 'utf8');
      }
    },
    catch: (error) => {
      return new CommandError({
        command: `restore Cursor agent models in ${CURSOR_PLUGIN_DIR}/agents`,
        message: String(error),
      });
    },
  });
}

const cursor: PlatformHandler = {
  id: 'cursor',
  label: 'Cursor',
  npmPackage: '@maestria/cursor',

  detect: Effect.gen(function* () {
    if (yield* cursorCliName()) {
      return true;
    }
    // An unrelated `agent` binary (for example another vendor's CLI) must not
    // be rescued by the broad ~/.cursor directory fallback.
    if (yield* commandExists('agent')) {
      return false;
    }
    return yield* fileExists(`${homedir()}/.cursor`);
  }),

  isInstalled: fileExists(CURSOR_PLUGIN_JSON),

  getInstalledVersion: readTextFile(`${CURSOR_PLUGIN_DIR}/package.json`).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/cursor'),

  install: Effect.gen(function* () {
    const models = yield* readCursorAgentModels();
    yield* Effect.tryPromise({
      try: async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(`${homedir()}/.cursor/plugins/local`, { recursive: true });
      },
      catch: (error) => {
        return new CommandError({
          command: `mkdir -p ${homedir()}/.cursor/plugins/local`,
          message: String(error),
        });
      },
    });
    yield* installNpmTarball('@maestria/cursor', CURSOR_PLUGIN_DIR);
    yield* restoreCursorAgentModels(models);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) => {
    return Effect.gen(function* () {
      const tag = version ?? 'latest';
      const models = yield* readCursorAgentModels();
      yield* installNpmTarball('@maestria/cursor', CURSOR_PLUGIN_DIR, { tag });
      yield* restoreCursorAgentModels(models);
      // Invalidate version cache so npmViewVersion doesn't return stale data
      yield* invalidateVersionCache('@maestria/cursor').pipe(
        Effect.catchCause(() => {
          return Effect.void;
        }),
      );
    }).pipe(Effect.as(void 0));
  },

  uninstall: Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => {
        return import('node:fs/promises').then((m) => {
          return m.rm(CURSOR_PLUGIN_DIR, { recursive: true, force: true });
        });
      },
      catch: (e) => {
        return new CommandError({ command: `rm -rf ${CURSOR_PLUGIN_DIR}`, message: String(e) });
      },
    });
  }).pipe(Effect.as(void 0)),
};

const omp: PlatformHandler = {
  id: 'omp',
  label: 'Oh My Pi',
  npmPackage: '@maestria/omp',

  detect: commandExists('omp'),

  isInstalled: fileExists(`${homedir()}/.omp/plugins/node_modules/@maestria/omp/package.json`),

  getInstalledVersion: readTextFile(
    `${homedir()}/.omp/plugins/node_modules/@maestria/omp/package.json`,
  ).pipe(
    Effect.map((out: string) => {
      try {
        const pkg: { version?: string } = JSON.parse(out);
        return pkg.version ?? 'unknown';
      } catch {
        return 'unknown';
      }
    }),
    Effect.catchCause(() => {
      return Effect.succeed('unknown');
    }),
  ),

  getLatestVersion: npmViewVersion('@maestria/omp'),

  install: Effect.gen(function* () {
    // omp has built-in task dispatch - no subagent prerequisite needed
    yield* run('omp', ['plugin', 'install', '@maestria/omp'], 120_000);
  }).pipe(Effect.as(void 0)),

  update: (version?: string) => {
    return Effect.gen(function* () {
      const tagged = version ? `@maestria/omp@${version}` : '@maestria/omp@latest';
      yield* run('omp', ['plugin', 'install', tagged], 120_000);
    });
  },

  uninstall: run('omp', ['plugin', 'uninstall', '@maestria/omp']).pipe(Effect.as(void 0)),
};

// ── Registry ─────────────────────────────────────────
export const platforms: readonly PlatformHandler[] = [
  opencode,
  pi,
  primeAgent,
  kimiCode,
  hermes,
  cursor,
  omp,
  claudeCode,
  codex,
];

export function getPlatform(id: string): PlatformHandler | undefined {
  return platforms.find((p) => {
    return p.id === id;
  });
}
