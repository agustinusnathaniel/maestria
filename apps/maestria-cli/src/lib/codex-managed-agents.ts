/** Codex native-agent files and managed-instruction install transaction. */
import { Effect } from 'effect';
import { homedir } from 'node:os';

import { codexManagedAgentFileName, mergeCodexAgentSettings } from '@/lib/codex-agent-files.js';
import {
  CODEX_GLOBAL_INSTRUCTION_FILENAMES,
  hasCodexManagedInstructions,
  removeCodexManagedInstructions,
  upsertCodexManagedInstructions,
} from '@/lib/codex-instructions.js';
import type { CodexGlobalInstructionFilename } from '@/lib/codex-instructions.js';
import { MAESTRIA_AGENTS } from '@/lib/model-config.js';
import { isFileNotFound, parseJsonRecord } from '@/lib/primitives.js';
import type { JsonRecord } from '@/lib/primitives.js';
import { CommandError } from '@/lib/shell.js';

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

const codexHomePath = (): string => process.env.CODEX_HOME?.trim() ?? `${homedir()}/.codex`;

const codexManagedAgentDirectory = (): string => `${codexHomePath()}/agents`;

const codexManagedAgentManifestPath = (): string =>
  `${codexHomePath()}/${CODEX_MANAGED_AGENT_MANIFEST}`;

const codexGlobalInstructionsPath = (file: CodexGlobalInstructionFilename): string =>
  `${codexHomePath()}/${file}`;

const validateCodexManifestContent = (
  parsed: JsonRecord,
): parsed is JsonRecord & CodexManagedAgentManifest => {
  if (parsed.version !== 1 || !Array.isArray(parsed.files)) {
    throw new Error(`invalid Maestria Codex agent manifest at ${codexManagedAgentManifestPath()}`);
  }
  if (
    !parsed.files.every((file) => typeof file === 'string' && /^[A-Za-z0-9_-]+\.toml$/u.test(file))
  ) {
    throw new Error(`invalid managed agent filename in ${codexManagedAgentManifestPath()}`);
  }
  if (
    parsed.instructionsFile !== undefined &&
    !CODEX_GLOBAL_INSTRUCTION_FILENAMES.some((file) => file === parsed.instructionsFile)
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
  return true;
};

const readCodexManagedAgentManifest = (): Effect.Effect<CodexManagedAgentManifest, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `read ${codexManagedAgentManifestPath()}`,
        message: String(error),
      }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      let raw: string;
      try {
        raw = await readFile(codexManagedAgentManifestPath(), 'utf-8');
      } catch (error) {
        if (isFileNotFound(error)) {
          return { files: [], version: 1 } satisfies CodexManagedAgentManifest;
        }
        throw error;
      }
      const parsed = parseJsonRecord(raw);
      if (parsed === undefined) {
        throw new Error(
          `invalid Maestria Codex agent manifest at ${codexManagedAgentManifestPath()}`,
        );
      }
      if (!validateCodexManifestContent(parsed)) {
        throw new Error(
          `invalid Maestria Codex agent manifest at ${codexManagedAgentManifestPath()}`,
        );
      }
      return {
        files: parsed.files,
        version: 1,
        ...(parsed.instructionsFile === undefined
          ? {}
          : { instructionsFile: parsed.instructionsFile }),
        ...(parsed.instructionsCreated === undefined
          ? {}
          : { instructionsCreated: parsed.instructionsCreated }),
      } satisfies CodexManagedAgentManifest;
    },
  });

const writeCodexManagedAgentManifest = (
  manifest: CodexManagedAgentManifest,
): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) =>
      new CommandError({
        command: `write ${codexManagedAgentManifestPath()}`,
        message: String(error),
      }),
    try: async () => {
      const { mkdir, rename, writeFile } = await import('node:fs/promises');
      await mkdir(codexHomePath(), { recursive: true });
      const manifestPath = codexManagedAgentManifestPath();
      const tempPath = `${manifestPath}.tmp`;
      await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
      await rename(tempPath, manifestPath);
    },
  });

interface CodexInstructionState {
  readonly created: boolean;
  readonly file: CodexGlobalInstructionFilename;
}

const readCodexGlobalInstructions = async (): Promise<
  Map<CodexGlobalInstructionFilename, string | undefined>
> => {
  const { readFile } = await import('node:fs/promises');
  const entries = await Promise.all(
    CODEX_GLOBAL_INSTRUCTION_FILENAMES.map(
      async (file): Promise<[CodexGlobalInstructionFilename, string | undefined]> => {
        try {
          return [file, await readFile(codexGlobalInstructionsPath(file), 'utf-8')];
        } catch (error) {
          if (isFileNotFound(error)) {
            return [file, undefined];
          }
          throw error;
        }
      },
    ),
  );
  return new Map(entries);
};

const selectCodexInstructionTarget = (
  existing: ReadonlyMap<CodexGlobalInstructionFilename, string | undefined>,
  manifest: CodexManagedAgentManifest,
): CodexGlobalInstructionFilename => {
  const override = existing.get('AGENTS.override.md');
  const hasOverride = override !== undefined && override.trim() !== '';
  const managedFiles = CODEX_GLOBAL_INSTRUCTION_FILENAMES.filter((file) => {
    const content = existing.get(file);
    return content !== undefined && hasCodexManagedInstructions(content);
  });
  if (hasOverride && !managedFiles.includes('AGENTS.override.md')) {
    return 'AGENTS.override.md';
  }
  if (manifest.instructionsFile !== undefined && managedFiles.includes(manifest.instructionsFile)) {
    return manifest.instructionsFile;
  }
  const [firstManagedFile] = managedFiles;
  if (firstManagedFile !== undefined) {
    return firstManagedFile;
  }
  return hasOverride ? 'AGENTS.override.md' : 'AGENTS.md';
};

const writeCodexGlobalInstructions = async (
  existing: ReadonlyMap<CodexGlobalInstructionFilename, string | undefined>,
  cleaned: ReadonlyMap<CodexGlobalInstructionFilename, string | undefined>,
  target: CodexGlobalInstructionFilename,
  targetContent: string,
  manifest: CodexManagedAgentManifest,
): Promise<void> => {
  const { mkdir, rename, rm, writeFile } = await import('node:fs/promises');
  const writeAtomic = async (filePath: string, content: string): Promise<void> => {
    await mkdir(codexHomePath(), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, content, 'utf-8');
    await rename(tempPath, filePath);
  };
  const operations: Promise<void>[] = [];
  for (const file of CODEX_GLOBAL_INSTRUCTION_FILENAMES) {
    if (file === target) {
      operations.push(writeAtomic(codexGlobalInstructionsPath(file), targetContent));
      continue;
    }
    const original = existing.get(file);
    const next = cleaned.get(file);
    if (original === undefined || next === undefined || next === original) {
      continue;
    }
    if (
      next.length === 0 &&
      manifest.instructionsCreated === true &&
      manifest.instructionsFile === file
    ) {
      operations.push(rm(codexGlobalInstructionsPath(file), { force: true }));
      continue;
    }
    operations.push(writeAtomic(codexGlobalInstructionsPath(file), next));
  }
  await Promise.all(operations);
};

const syncCodexGlobalInstructions = async (
  sourceInstructions: string,
  manifest: CodexManagedAgentManifest,
): Promise<CodexInstructionState> => {
  const existing = await readCodexGlobalInstructions();
  const target = selectCodexInstructionTarget(existing, manifest);
  const cleaned = new Map<CodexGlobalInstructionFilename, string | undefined>();
  for (const file of CODEX_GLOBAL_INSTRUCTION_FILENAMES) {
    const content = existing.get(file);
    cleaned.set(file, content === undefined ? undefined : removeCodexManagedInstructions(content));
  }
  const targetContent = upsertCodexManagedInstructions(
    cleaned.get(target) ?? '',
    sourceInstructions,
  );
  await writeCodexGlobalInstructions(existing, cleaned, target, targetContent, manifest);
  return {
    created:
      existing.get(target) === undefined ||
      (manifest.instructionsCreated === true && manifest.instructionsFile === target),
    file: target,
  };
};

// oxlint-disable-next-line max-lines-per-function -- installCodexManagedAgents is a single atomic Codex install transaction (read manifest, validate instructions, copy agent TOMLs with merge, clean stale files, sync global instructions). Splitting would obscure the required sequential ordering and create single-use helpers that hurt discoverability of the transaction flow. Cohesion is around one install operation.
export const installCodexManagedAgents = (packageRoot: string): Effect.Effect<void, CommandError> =>
  // oxlint-disable-next-line max-lines-per-function -- Effect.gen generator orchestrates the same atomic Codex transaction; splitting the generator would duplicate manifest/sourceFiles/targetDir closure and hide the linear install steps. Kept intact for cohesion.
  Effect.gen(function* installCodexManagedAgentsEffect() {
    const manifest = yield* readCodexManagedAgentManifest();
    const sourceDir = `${packageRoot}/agents`;
    const targetDir = codexManagedAgentDirectory();
    const sourceFiles = MAESTRIA_AGENTS.map(codexManagedAgentFileName);
    const sourceInstructionsPath = `${packageRoot}/instructions/AGENTS.md`;

    const sourceInstructions = yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({ command: 'read codex instructions', message: String(error) }),
      try: async () => {
        const { readFile } = await import('node:fs/promises');
        return await readFile(sourceInstructionsPath, 'utf-8');
      },
    });
    if (!hasCodexManagedInstructions(sourceInstructions)) {
      yield* Effect.fail(
        new CommandError({
          command: 'validate codex instructions',
          message: `missing Maestria instruction markers in ${sourceInstructionsPath}`,
        }),
      );
    }

    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `copy Codex managed agents to ${targetDir}`,
          message: String(error),
        }),
      try: async () => {
        const { mkdir, readFile, rename, writeFile } = await import('node:fs/promises');
        await mkdir(targetDir, { recursive: true });
        const copyAgent = async (file: string, agent: string): Promise<void> => {
          const sourcePath = `${sourceDir}/${file}`;
          const targetPath = `${targetDir}/${file}`;
          const bundled = await readFile(sourcePath, 'utf-8');
          const existingContents = await Promise.all(
            [targetPath, `${targetDir}/${agent}.toml`].map(async (existingPath) => {
              try {
                return await readFile(existingPath, 'utf-8');
              } catch (error) {
                if (isFileNotFound(error)) {
                  return null;
                }
                throw error;
              }
            }),
          );
          const existing = existingContents.find((content) => content !== null);
          const next =
            existing === undefined ? bundled : mergeCodexAgentSettings(bundled, existing);
          const tempPath = `${targetPath}.tmp`;
          await writeFile(tempPath, next, 'utf-8');
          await rename(tempPath, targetPath);
        };
        await Promise.all(
          sourceFiles.map(async (file, index) => {
            const agent = MAESTRIA_AGENTS[index];
            if (agent === undefined) {
              return;
            }
            await copyAgent(file, agent);
          }),
        );
      },
    });

    const currentFiles = new Set(sourceFiles);
    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `remove stale Codex managed agents from ${targetDir}`,
          message: String(error),
        }),
      try: async () => {
        const { rm } = await import('node:fs/promises');
        await Promise.all(
          manifest.files
            .filter((file) => !currentFiles.has(file))
            .map(async (file) => {
              await rm(`${targetDir}/${file}`, { force: true });
            }),
        );
      },
    });

    const instructionState = yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `sync Codex global instructions in ${codexHomePath()}`,
          message: String(error),
        }),
      try: async () => await syncCodexGlobalInstructions(sourceInstructions, manifest),
    });

    yield* writeCodexManagedAgentManifest({
      files: sourceFiles,
      instructionsCreated: instructionState.created,
      instructionsFile: instructionState.file,
      version: 1,
    });
  });

const removeCodexFiles = async (files: readonly string[], directory: string): Promise<void> => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    files.map(async (file) => {
      await rm(`${directory}/${file}`, { force: true });
    }),
  );
};

const removeCodexInstructionFiles = async (manifest: CodexManagedAgentManifest): Promise<void> => {
  const { readFile, rename, rm, writeFile } = await import('node:fs/promises');
  const operations = CODEX_GLOBAL_INSTRUCTION_FILENAMES.map(async (file) => {
    const filePath = codexGlobalInstructionsPath(file);
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      if (isFileNotFound(error)) {
        return;
      }
      throw error;
    }
    const next = removeCodexManagedInstructions(content);
    if (next === content) {
      return;
    }
    if (
      next.length === 0 &&
      manifest.instructionsCreated === true &&
      manifest.instructionsFile === file
    ) {
      await rm(filePath, { force: true });
      return;
    }
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, next, 'utf-8');
    await rename(tempPath, filePath);
  });
  await Promise.all(operations);
};

export const removeCodexManagedAgents = (): Effect.Effect<void, CommandError> =>
  Effect.gen(function* removeCodexManagedAgentsEffect() {
    const manifest = yield* readCodexManagedAgentManifest();
    yield* Effect.tryPromise({
      catch: (error) =>
        new CommandError({
          command: `remove Codex native agents from ${codexManagedAgentDirectory()}`,
          message: String(error),
        }),
      try: async () => {
        const { rm } = await import('node:fs/promises');
        await removeCodexFiles(manifest.files, codexManagedAgentDirectory());
        await removeCodexInstructionFiles(manifest);
        await rm(codexManagedAgentManifestPath(), { force: true });
      },
    });
  });
