// oxlint-disable max-lines -- single cohesive handler registry; splitting would fragment registration.
import { Effect } from 'effect';
import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parse,
  parseTree,
} from 'jsonc-parser/lib/esm/main.js';
import { homedir } from 'node:os';
import path from 'node:path';

// ESM build: the UMD entry's runtime `require('./impl/*')` is not inlined.
import { parseAgentFrontmatterModel, setAgentFrontmatterModel } from '@/lib/agent-frontmatter.js';
import {
  codexManagedAgentFileName,
  codexManagedAgentName,
  parseCodexTopLevelString,
  setCodexTopLevelString,
} from '@/lib/codex-agent-files.js';
import { cursorCliName } from '@/lib/cursor-cli.js';
import { openCodeConfigDir } from '@/lib/opencode.js';
import { isRecord, parseJsonValue } from '@/lib/primitives.js';
import { CommandError, fileExists, readTextFile, run } from '@/lib/shell.js';

export type ModelConfigLevel = 'global' | 'project';

export const MAESTRIA_AGENTS = ['adventurer', 'architect', 'builder', 'reviewer'] as const;
export type AgentName = (typeof MAESTRIA_AGENTS)[number];

/** Empty string means "inherit" (session model). */
export type AgentModels = Partial<Record<AgentName, string>>;

export const isAgentName = (name: string): name is AgentName =>
  MAESTRIA_AGENTS.some((agent) => agent === name);

export interface ModelConfigHandler {
  readonly id: string;
  readonly label: string;
  readonly cli: string;
  readonly agents: readonly string[];
  readonly configLevels: readonly ModelConfigLevel[];
  readonly restartHint: string;
  readonly isAvailable?: Effect.Effect<boolean>;
  readonly listModels: Effect.Effect<string[], CommandError>;
  readonly readCurrent: (level: ModelConfigLevel) => Effect.Effect<AgentModels, CommandError>;
  readonly write: (
    models: AgentModels,
    level: ModelConfigLevel,
  ) => Effect.Effect<void, CommandError>;
}

export const parseOpenCodeModels = (out: string): string[] =>
  out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\S+\/\S+$/u.test(line));

export const parsePiModels = (out: string): string[] =>
  out
    .split('\n')
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length >= 2 && parts[0] !== 'provider')
    .map((parts) => `${parts[0]}/${parts[1]}`);

export const parseCursorModels = (out: string): string[] => {
  const parsed = parseJsonValue(out);
  let entries: unknown[] | undefined;
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (isRecord(parsed) && Array.isArray(parsed.models)) {
    entries = parsed.models;
  }
  if (entries !== undefined) {
    const models = entries.flatMap((entry) => {
      if (typeof entry === 'string') {
        return [entry];
      }
      if (isRecord(entry)) {
        const value = entry.id ?? entry.slug ?? entry.name;
        return typeof value === 'string' ? [value] : [];
      }
      return [];
    });
    if (models.length > 0) {
      return [...new Set(models)];
    }
  }

  const models: string[] = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    const match =
      /^(?<model>[A-Za-z0-9][A-Za-z0-9._-]*)(?:\s+-\s+.*)?(?:\s+\((?:current|default)\))?$/u.exec(
        trimmed,
      );
    if (
      match?.groups?.model !== undefined &&
      match.groups.model !== '' &&
      !/^(?:available|models|filter)$/iu.test(match.groups.model)
    ) {
      models.push(match.groups.model);
    }
  }
  return [...new Set(models)];
};

export const parseCodexModels = (out: string): string[] => {
  const parsed = parseJsonValue(out);
  if (!isRecord(parsed) || !Array.isArray(parsed.models)) {
    return [];
  }
  return [
    ...new Set(
      parsed.models.flatMap((model) => {
        if (!isRecord(model)) {
          return [];
        }
        const value = typeof model.slug === 'string' ? model.slug : model.id;
        return typeof value === 'string' && value.length > 0 ? [value] : [];
      }),
    ),
  ];
};

const JSONC_OPTIONS = { formattingOptions: { insertSpaces: true, tabSize: 2 } } as const;

// OpenCode V2 configures agents under `agents` and still accepts the V1 `agent` map.
type AgentMap = 'agent' | 'agents';

const hasConfigModel = (text: string, map: AgentMap, agent: string): boolean => {
  const tree = parseTree(text);
  if (!tree) {
    return false;
  }
  return findNodeAtLocation(tree, [map, agent, 'model']) !== undefined;
};

// jsonc-parser >= 3.3 throws on removing a non-existent path.
const removeConfigModel = (text: string, map: AgentMap, agent: string): string =>
  hasConfigModel(text, map, agent)
    ? applyEdits(text, modify(text, [map, agent, 'model'], undefined, JSONC_OPTIONS))
    : text;

/** Writes the V2 `agents` model and drops a V1 one, which OpenCode would report as conflicting. */
export const setConfigModelJsonc = (text: string, agent: string, model: string): string => {
  const next = removeConfigModel(text, 'agent', agent);
  if (!model) {
    return removeConfigModel(next, 'agents', agent);
  }
  return applyEdits(next, modify(next, ['agents', agent, 'model'], model, JSONC_OPTIONS));
};

export const parseConfigModels = (text: string): AgentModels => {
  const parsed: unknown = parse(text);
  if (!isRecord(parsed)) {
    return {};
  }
  const result: AgentModels = {};
  // A V2 `agents` value takes precedence over the V1 `agent` map, as in OpenCode.
  for (const map of ['agent', 'agents'] as const) {
    const agents = parsed[map];
    if (!isRecord(agents)) {
      continue;
    }
    for (const [name, value] of Object.entries(agents)) {
      if (isAgentName(name) && isRecord(value) && typeof value.model === 'string' && value.model) {
        result[name] = value.model;
      }
    }
  }
  return result;
};

export const parseCodexAgentModel = (content: string): string | undefined =>
  parseCodexTopLevelString(content, 'model');

export const setCodexAgentModel = (content: string, model: string): string =>
  setCodexTopLevelString(content, 'model', model || undefined);

export const createCodexAgentConfig = (
  agent: AgentName,
  model: string,
  nativeName = codexManagedAgentName(agent),
): string => {
  const readOnly = new Set<AgentName>(['adventurer', 'architect', 'reviewer']);
  const description = `maestria ${agent} specialist. Use for ${agent}-focused workflow work.`;
  const instructions = [
    `Load the $maestria:${agent} skill before acting.`,
    `Stay within the ${agent} specialist role and return a concise handoff to the parent agent.`,
  ].join('\n');
  const lines = [
    `name = ${JSON.stringify(nativeName)}`,
    `description = ${JSON.stringify(description)}`,
    `developer_instructions = ${JSON.stringify(instructions)}`,
    `model = ${JSON.stringify(model)}`,
  ];
  if (readOnly.has(agent)) {
    lines.push('sandbox_mode = "read-only"');
  }
  return `${lines.join('\n')}\n`;
};

const writeFile = (filePath: string, content: string): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) => new CommandError({ command: `write ${filePath}`, message: String(error) }),
    try: async () => {
      const { writeFile: writeFileAsync, mkdir } = await import('node:fs/promises');
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFileAsync(filePath, content, 'utf-8');
    },
  });

const readAgentModels = (
  readContent: (agent: AgentName) => Effect.Effect<string>,
  parseModel: (content: string) => string | undefined,
): Effect.Effect<AgentModels, CommandError> =>
  Effect.all(MAESTRIA_AGENTS.map(readContent)).pipe(
    Effect.map((contents) => {
      const result: AgentModels = {};
      for (let i = 0; i < MAESTRIA_AGENTS.length; i += 1) {
        const model = parseModel(contents[i] ?? '');
        if (model !== undefined && model !== '') {
          result[MAESTRIA_AGENTS[i]] = model;
        }
      }
      return result;
    }),
  );

const openCodeGlobalCandidates = (): string[] => [
  path.join(openCodeConfigDir(), 'opencode.jsonc'),
  path.join(openCodeConfigDir(), 'opencode.json'),
];
const OPENCODE_PROJECT_CANDIDATES = [
  '.opencode/opencode.jsonc',
  '.opencode/opencode.json',
  'opencode.jsonc',
  'opencode.json',
];
const OPENCODE_PROJECT_CREATE = '.opencode/opencode.jsonc';

const firstExisting = (candidates: readonly string[], fallback: string): Effect.Effect<string> =>
  Effect.all(candidates.map((p) => fileExists(p))).pipe(
    Effect.map((exists) => candidates[exists.indexOf(true)] ?? fallback),
  );

const findOpenCodeConfigPath = (level: ModelConfigLevel): Effect.Effect<string> =>
  level === 'global'
    ? firstExisting(openCodeGlobalCandidates(), openCodeGlobalCandidates()[0] ?? '')
    : firstExisting(OPENCODE_PROJECT_CANDIDATES, OPENCODE_PROJECT_CREATE);

const opencode: ModelConfigHandler = {
  agents: MAESTRIA_AGENTS,
  cli: 'opencode',
  configLevels: ['global', 'project'],
  id: 'opencode',
  label: 'OpenCode',
  listModels: run('opencode', ['models'], 30_000).pipe(Effect.map(parseOpenCodeModels)),
  readCurrent: (level) =>
    findOpenCodeConfigPath(level).pipe(
      Effect.flatMap((configPath) =>
        readTextFile(configPath).pipe(Effect.catchEager(() => Effect.succeed(''))),
      ),
      Effect.map(parseConfigModels),
    ),
  restartHint: 'Restart OpenCode (or reload the config) for the changes to take effect.',
  write: (models, level) =>
    Effect.gen(function* write() {
      const configPath = yield* findOpenCodeConfigPath(level);
      const text = yield* readTextFile(configPath).pipe(
        Effect.catchEager(() => Effect.succeed('{}')),
      );
      let next = text;
      for (const [agent, model] of Object.entries(models)) {
        next = setConfigModelJsonc(next, agent, model ?? '');
      }
      yield* writeFile(configPath, next);
    }),
};

export const codexHome = (): string => process.env.CODEX_HOME?.trim() ?? `${homedir()}/.codex`;

const resolveCodexAgentPath = (level: ModelConfigLevel, agent: string): Effect.Effect<string> => {
  const dir = level === 'global' ? `${codexHome()}/agents` : '.codex/agents';
  const candidates = [`${dir}/${codexManagedAgentFileName(agent)}`, `${dir}/${agent}.toml`];
  return firstExisting(candidates, candidates[0]);
};

const codex: ModelConfigHandler = {
  agents: MAESTRIA_AGENTS,
  cli: 'codex',
  configLevels: ['global', 'project'],
  id: 'codex',
  label: 'Codex CLI',
  listModels: run('codex', ['debug', 'models'], 30_000).pipe(Effect.map(parseCodexModels)),
  readCurrent: (level) =>
    readAgentModels(
      (agent) =>
        resolveCodexAgentPath(level, agent).pipe(
          Effect.flatMap((agentPath) => readTextFile(agentPath)),
          Effect.catchEager(() => Effect.succeed('')),
        ),
      parseCodexAgentModel,
    ),
  restartHint: 'Start a new Codex session for the custom-agent configuration to take effect.',
  write: (models, level) =>
    Effect.gen(function* write() {
      for (const [agent, model] of Object.entries(models)) {
        if (!isAgentName(agent)) {
          continue;
        }
        const agentPath = yield* resolveCodexAgentPath(level, agent);
        const exists = yield* fileExists(agentPath);
        if (!exists) {
          if (model) {
            yield* writeFile(
              agentPath,
              createCodexAgentConfig(agent, model, codexManagedAgentName(agent)),
            );
          }
          continue;
        }
        const content = yield* readTextFile(agentPath);
        yield* writeFile(agentPath, setCodexAgentModel(content, model ?? ''));
      }
    }),
};

const listCursorModels = (): Effect.Effect<string[], CommandError> =>
  cursorCliName().pipe(
    Effect.flatMap((cli) => {
      if (cli === undefined || cli === null || cli === '') {
        return Effect.fail(
          new CommandError({
            command: 'cursor agent',
            message: "Cursor's 'agent' or 'cursor-agent' CLI was not found on PATH.",
          }),
        );
      }
      // Older cursor-agent releases expose `--list-models` instead of `models`.
      return run(cli, ['models'], 30_000).pipe(
        Effect.catchTag('CommandError', () => run(cli, ['--list-models'], 30_000)),
      );
    }),
    Effect.map(parseCursorModels),
  );

interface AgentFilePlatform {
  readonly id: string;
  readonly label: string;
  readonly cli: string;
  readonly globalDir: () => string;
  /** Agents bundled in the installed package, for hosts that deploy them on first load. */
  readonly bundledDir?: () => string;
  readonly projectDir: string;
  readonly listModels: Effect.Effect<string[], CommandError>;
  readonly restartHint: string;
  readonly isAvailable?: Effect.Effect<boolean>;
}

// oxlint-disable-next-line max-lines-per-function -- cohesive per-agent file factory, keep intact.
const createAgentFileHandler = (cfg: AgentFilePlatform): ModelConfigHandler => {
  /** Project level copies global content (runtime merges project over global). */
  const resolveAgent = (
    level: ModelConfigLevel,
    agent: string,
  ): Effect.Effect<{ path: string; content: string }, CommandError> => {
    const target = `${level === 'global' ? cfg.globalDir() : cfg.projectDir}/${agent}.md`;
    const global = `${cfg.globalDir()}/${agent}.md`;
    const bundled = cfg.bundledDir === undefined ? undefined : `${cfg.bundledDir()}/${agent}.md`;
    const readGlobal = readTextFile(global).pipe(
      Effect.catchTag('CommandError', (failure) =>
        bundled === undefined ? Effect.fail(failure) : readTextFile(bundled),
      ),
    );
    return readTextFile(target)
      .pipe(
        Effect.catchTag('CommandError', () =>
          level === 'global'
            ? readGlobal.pipe(
                Effect.mapError(
                  () =>
                    new CommandError({
                      command: `read ${target}`,
                      message: `Agent file not found at ${target}. Run 'maestria install ${cfg.id}' first.`,
                    }),
                ),
              )
            : readGlobal.pipe(
                Effect.catchTag('CommandError', () =>
                  Effect.fail(
                    new CommandError({
                      command: `read ${global}`,
                      message: `Neither ${target} nor ${global} exists. Run 'maestria install ${cfg.id}' first.`,
                    }),
                  ),
                ),
              ),
        ),
      )
      .pipe(Effect.map((content) => ({ content, path: target })));
  };

  return {
    agents: MAESTRIA_AGENTS,
    cli: cfg.cli,
    configLevels: ['global', 'project'],
    id: cfg.id,
    isAvailable: cfg.isAvailable,
    label: cfg.label,
    listModels: cfg.listModels,
    readCurrent: (level) =>
      readAgentModels(
        (agent) =>
          resolveAgent(level, agent).pipe(
            Effect.map(({ content }) => content),
            Effect.catchEager(() => Effect.succeed('')),
          ),
        (content) => parseAgentFrontmatterModel(content, { fallbackToContent: true }),
      ),
    restartHint: cfg.restartHint,
    write: (models, level) =>
      Effect.gen(function* write() {
        for (const [agent, model] of Object.entries(models)) {
          const { path: targetPath, content } = yield* resolveAgent(level, agent);
          const next = setAgentFrontmatterModel(content, model ?? '', { createFrontmatter: true });
          yield* writeFile(targetPath, next);
        }
      }),
  };
};

const pi = createAgentFileHandler({
  bundledDir: () => `${homedir()}/.pi/agent/npm/node_modules/@maestria/pi/agents`,
  cli: 'pi',
  globalDir: () => `${homedir()}/.pi/agent/agents`,
  id: 'pi',
  label: 'Pi',
  listModels: run('pi', ['--list-models'], 30_000).pipe(Effect.map(parsePiModels)),
  projectDir: '.pi/agents',
  restartHint: 'Start a new Pi session for the changes to take effect.',
});

const cursor = createAgentFileHandler({
  cli: 'agent',
  // Project-level configuration uses Cursor's native `.cursor/agents` overlay.
  globalDir: () => `${homedir()}/.cursor/plugins/local/maestria/agents`,
  id: 'cursor',
  isAvailable: cursorCliName().pipe(Effect.map((cli) => cli !== undefined && cli !== '')),
  label: 'Cursor',
  listModels: listCursorModels(),
  projectDir: '.cursor/agents',
  restartHint: 'Start a new Cursor Agent session for the changes to take effect.',
});

export const modelConfigHandlers: readonly ModelConfigHandler[] = [opencode, codex, cursor, pi];

export const getModelConfigHandler = (id: string): ModelConfigHandler | undefined =>
  modelConfigHandlers.find((h) => h.id === id);
