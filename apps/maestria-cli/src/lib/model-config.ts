// oxlint-disable max-lines -- model-config aggregates 5 platform handlers (opencode/codex/pi/cursor/omp) plus shared parsers and FS helpers as a single cohesive registry; splitting would fragment the handler registration and create single-use modules with one call site.
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

// Import the ESM build directly - the UMD entry does runtime `require('./impl/*')`
// calls that the bundler does not inline.
import {
  codexManagedAgentFileName,
  codexManagedAgentName,
  parseCodexTopLevelString,
  setCodexTopLevelString,
} from '@/lib/codex-agent-files.js';
import { CommandError, commandExists, run } from '@/lib/shell.js';

// ── Types ─────────────────────────────────────────────

export type ModelConfigLevel = 'global' | 'project';

/** The 7 maestria specialist agents (no orchestrator - it uses the session model) */
export const MAESTRIA_AGENTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
] as const;
export type AgentName = (typeof MAESTRIA_AGENTS)[number];

/**
 * Agent name -> model id mapping.
 * An empty string means "inherit" (use the session/primary agent model).
 */
export type AgentModels = Partial<Record<AgentName, string>>;

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonValue = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const isAgentName = (name: string): name is AgentName =>
  MAESTRIA_AGENTS.some((agent) => agent === name);

/**
 * Handles per-agent model configuration for one platform.
 * The CLI writes native config files directly:
 * - opencode: `agent.<name>.model` in opencode.json(c)
 * - codex:    `model` in native `.codex/agents/maestria-<name>.toml` files
 * - pi/omp:   `model:` frontmatter in agent markdown files
 */
export interface ModelConfigHandler {
  readonly id: string;
  readonly label: string;
  /** The platform CLI binary used to list available models */
  readonly cli: string;
  readonly agents: readonly string[];
  readonly configLevels: readonly ModelConfigLevel[];
  readonly restartHint: string;
  /** Optional host-specific identity check when the binary name is ambiguous. */
  readonly isAvailable?: Effect.Effect<boolean>;
  readonly listModels: Effect.Effect<string[], CommandError>;
  readonly readCurrent: (level: ModelConfigLevel) => Effect.Effect<AgentModels, CommandError>;
  readonly write: (
    models: AgentModels,
    level: ModelConfigLevel,
  ) => Effect.Effect<void, CommandError>;
}

// ── Model listing parsers (pure) ──────────────────────

/** `opencode models` -> one `provider/model` per line */
export const parseOpenCodeModels = (out: string): string[] =>
  out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\S+\/\S+$/u.test(line));

/** `pi --list-models` -> table with a header row */
export const parsePiModels = (out: string): string[] =>
  out
    .split('\n')
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length >= 2 && parts[0] !== 'provider')
    .map((parts) => `${parts[0]}/${parts[1]}`);

/** `omp models --json` -> { models: [{ provider, id, selector, ... }] } */
export const parseOmpModels = (out: string): string[] => {
  const parsed = parseJsonValue(out);
  if (!isJsonRecord(parsed) || !Array.isArray(parsed.models)) {
    return [];
  }
  return parsed.models.flatMap((model) => {
    if (!isJsonRecord(model) || typeof model.selector !== 'string' || model.selector.length === 0) {
      return [];
    }
    return [model.selector];
  });
};

/** `agent --list-models` -> one Cursor model id per line. */
export const parseCursorModels = (out: string): string[] => {
  const parsed = parseJsonValue(out);
  let entries: unknown[] | undefined;
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (isJsonRecord(parsed) && Array.isArray(parsed.models)) {
    entries = parsed.models;
  }
  if (entries !== undefined) {
    const models = entries.flatMap((entry) => {
      if (typeof entry === 'string') {
        return [entry];
      }
      if (isJsonRecord(entry)) {
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

/** `codex debug models` -> model slugs from the native JSON catalog. */
export const parseCodexModels = (out: string): string[] => {
  const parsed = parseJsonValue(out);
  if (!isJsonRecord(parsed) || !Array.isArray(parsed.models)) {
    return [];
  }
  return [
    ...new Set(
      parsed.models.flatMap((model) => {
        if (!isJsonRecord(model)) {
          return [];
        }
        const value = typeof model.slug === 'string' ? model.slug : model.id;
        return typeof value === 'string' && value.length > 0 ? [value] : [];
      }),
    ),
  ];
};

// ── Frontmatter helpers (pure) ────────────────────────

/** Extract the `model:` value from a markdown agent file's frontmatter */
export const parseFrontmatterModel = (content: string): string | undefined => {
  const fm = /^---\r?\n(?<body>[\s\S]*?)\r?\n---/u.exec(content);
  const block = fm?.groups?.body ?? content;
  const m = /^model:\s*(?<model>.+?)\s*$/mu.exec(block);
  return m?.groups?.model;
};

/**
 * Set (or remove, when model is '') the `model:` key in a markdown
 * agent file's frontmatter. Preserves all other content byte-for-byte.
 */
export const setFrontmatterModel = (content: string, model: string): string => {
  const fm = /^---\r?\n(?<body>[\s\S]*?)\r?\n---(?<afterClosing>\r?\n?)/u.exec(content);
  if (!fm) {
    if (!model) {
      return content;
    }
    return `---\nmodel: ${model}\n---\n\n${content}`;
  }
  const fmBody = fm.groups?.body;
  const afterClosing = fm.groups?.afterClosing;
  if (fmBody === undefined || afterClosing === undefined) {
    return content;
  }
  const rest = content.slice(fm[0].length);
  const lines = fmBody.split(/\r?\n/u);
  const idx = lines.findIndex((l) => l.startsWith('model:'));
  if (model) {
    if (idx === -1) {
      lines.push(`model: ${model}`);
    } else {
      lines[idx] = `model: ${model}`;
    }
  } else if (idx !== -1) {
    lines.splice(idx, 1);
  }
  return `---\n${lines.join('\n')}\n---${afterClosing}${rest}`;
};

// ── JSONC helpers (pure) ──────────────────────────────

const JSONC_OPTIONS = { formattingOptions: { insertSpaces: true, tabSize: 2 } } as const;

/**
 * Set (or remove, when model is '') `agent.<name>.model` in an
 * opencode config file. Preserves comments and formatting.
 */
const hasConfigModel = (text: string, agent: string): boolean => {
  const tree = parseTree(text);
  if (!tree) {
    return false;
  }
  return findNodeAtLocation(tree, ['agent', agent, 'model']) !== undefined;
};

export const setConfigModelJsonc = (text: string, agent: string, model: string): string => {
  if (!model && !hasConfigModel(text, agent)) {
    // jsonc-parser >= 3.3 throws when removing a non-existent path
    return text;
  }
  const edits = modify(text, ['agent', agent, 'model'], model || undefined, JSONC_OPTIONS);
  return applyEdits(text, edits);
};

/** Read `agent.<name>.model` values from an opencode config file */
export const parseConfigModels = (text: string): AgentModels => {
  const parsed: unknown = parse(text);
  if (!isJsonRecord(parsed) || !isJsonRecord(parsed.agent)) {
    return {};
  }
  const result: AgentModels = {};
  for (const [name, value] of Object.entries(parsed.agent)) {
    if (
      isAgentName(name) &&
      isJsonRecord(value) &&
      typeof value.model === 'string' &&
      value.model
    ) {
      result[name] = value.model;
    }
  }
  return result;
};

// ── Codex agent TOML helpers (pure) ────────────────────

/** Extract a top-level `model` value from a Codex custom-agent TOML file. */
export const parseCodexAgentModel = (content: string): string | undefined =>
  parseCodexTopLevelString(content, 'model');

/** Set or remove a top-level `model` entry without rewriting other TOML text. */
export const setCodexAgentModel = (content: string, model: string): string =>
  setCodexTopLevelString(content, 'model', model || undefined);

/** Create the smallest native Codex custom-agent file for a Maestria role. */
export const createCodexAgentConfig = (
  agent: AgentName,
  model: string,
  nativeName = codexManagedAgentName(agent),
): string => {
  const readOnly = new Set<AgentName>(['adventurer', 'architect', 'planner', 'reviewer']);
  const description = `Maestria ${agent} specialist. Use for ${agent}-focused workflow work.`;
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

// ── FS helpers ────────────────────────────────────────

const readFile = (filePath: string): Effect.Effect<string, CommandError> =>
  Effect.tryPromise({
    catch: (error) => new CommandError({ command: `read ${filePath}`, message: String(error) }),
    try: async () => {
      const { readFile: readFileAsync } = await import('node:fs/promises');
      return await readFileAsync(filePath, 'utf-8');
    },
  });

const writeFile = (filePath: string, content: string): Effect.Effect<void, CommandError> =>
  Effect.tryPromise({
    catch: (error) => new CommandError({ command: `write ${filePath}`, message: String(error) }),
    try: async () => {
      const { writeFile: writeFileAsync, mkdir } = await import('node:fs/promises');
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFileAsync(filePath, content, 'utf-8');
    },
  });

const fileExists = (filePath: string): Effect.Effect<boolean> =>
  Effect.promise(async () => {
    const { stat } = await import('node:fs/promises');
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  });

// ── OpenCode handler ──────────────────────────────────

const OPENCODE_GLOBAL_CANDIDATES = [
  `${homedir()}/.config/opencode/opencode.jsonc`,
  `${homedir()}/.config/opencode/opencode.json`,
];
const OPENCODE_PROJECT_CANDIDATES = [
  '.opencode/opencode.jsonc',
  '.opencode/opencode.json',
  'opencode.jsonc',
  'opencode.json',
];
const OPENCODE_PROJECT_CREATE = '.opencode/opencode.jsonc';

/** Resolve the config path for a level (first existing candidate, or the default to create) */
const findOpenCodeConfigPath = (level: ModelConfigLevel): Effect.Effect<string> => {
  const candidates = level === 'global' ? OPENCODE_GLOBAL_CANDIDATES : OPENCODE_PROJECT_CANDIDATES;
  const fallback = level === 'global' ? OPENCODE_GLOBAL_CANDIDATES[0] : OPENCODE_PROJECT_CREATE;
  return Effect.all(candidates.map((p) => fileExists(p))).pipe(
    Effect.map((exists) => candidates[exists.indexOf(true)] ?? fallback),
  );
};

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
        readFile(configPath).pipe(Effect.catchCause(() => Effect.succeed(''))),
      ),
      Effect.map(parseConfigModels),
    ),
  restartHint: 'Restart OpenCode (or reload the config) for the changes to take effect.',
  write: (models, level) =>
    Effect.gen(function* write() {
      const configPath = yield* findOpenCodeConfigPath(level);
      const text = yield* readFile(configPath).pipe(Effect.catchCause(() => Effect.succeed('{}')));
      let next = text;
      for (const [agent, model] of Object.entries(models)) {
        next = setConfigModelJsonc(next, agent, model ?? '');
      }
      yield* writeFile(configPath, next);
    }),
};

// ── Codex custom-agent handler ─────────────────────────

const codexHome = (): string => process.env.CODEX_HOME?.trim() ?? `${homedir()}/.codex`;

const codexAgentCandidates = (level: ModelConfigLevel, agent: string): string[] => {
  const directory = level === 'global' ? `${codexHome()}/agents` : '.codex/agents';
  return [`${directory}/${codexManagedAgentFileName(agent)}`, `${directory}/${agent}.toml`];
};

const resolveCodexAgentPath = (level: ModelConfigLevel, agent: string): Effect.Effect<string> => {
  const candidates = codexAgentCandidates(level, agent);
  return Effect.all(candidates.map((candidatePath) => fileExists(candidatePath))).pipe(
    Effect.map((exists) => candidates[exists.indexOf(true)] ?? candidates[0]),
  );
};

const codex: ModelConfigHandler = {
  agents: MAESTRIA_AGENTS,
  cli: 'codex',
  configLevels: ['global', 'project'],
  id: 'codex',
  label: 'Codex CLI',
  listModels: run('codex', ['debug', 'models'], 30_000).pipe(Effect.map(parseCodexModels)),
  readCurrent: (level) =>
    Effect.all(
      MAESTRIA_AGENTS.map((agent) =>
        resolveCodexAgentPath(level, agent).pipe(
          Effect.flatMap((agentPath) => readFile(agentPath)),
          Effect.catchCause(() => Effect.succeed('')),
        ),
      ),
    ).pipe(
      Effect.map((contents) => {
        const result: AgentModels = {};
        for (let i = 0; i < MAESTRIA_AGENTS.length; i += 1) {
          const model = parseCodexAgentModel(contents[i] ?? '');
          if (model !== undefined && model !== null && model !== '') {
            result[MAESTRIA_AGENTS[i]] = model;
          }
        }
        return result;
      }),
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
        const content = yield* readFile(agentPath);
        yield* writeFile(agentPath, setCodexAgentModel(content, model ?? ''));
      }
    }),
};

// ── Cursor agent-file handler ─────────────────────────

const cursorConfigCli = (): Effect.Effect<string | undefined> =>
  Effect.gen(function* cursorConfigCliEffect() {
    if (yield* commandExists('cursor-agent')) {
      return 'cursor-agent';
    }
    if (!(yield* commandExists('agent'))) {
      return '';
    }
    const version = yield* run('agent', ['--version'], 3000).pipe(
      Effect.catchCause(() => Effect.succeed('')),
    );
    return /cursor/iu.test(version) ? 'agent' : undefined;
  });

const cursorConfigCliOrFail = (): Effect.Effect<string, CommandError> =>
  cursorConfigCli().pipe(
    Effect.flatMap((cli) =>
      cli !== undefined && cli !== null && cli !== ''
        ? Effect.succeed(cli)
        : Effect.fail(
            new CommandError({
              command: 'cursor agent',
              message: "Cursor's 'agent' or 'cursor-agent' CLI was not found on PATH.",
            }),
          ),
    ),
  );

const listCursorModels = (): Effect.Effect<string[], CommandError> =>
  cursorConfigCliOrFail().pipe(
    Effect.flatMap((cli) =>
      // `agent models` is the current command; retain the older flag as a
      // compatibility fallback for cursor-agent releases that still expose it.
      run(cli, ['models'], 30_000).pipe(
        Effect.catchCause(() => run(cli, ['--list-models'], 30_000)),
      ),
    ),
    Effect.map(parseCursorModels),
  );

// ── Pi / omp handlers (shared agent-file logic) ───────

interface AgentFilePlatform {
  readonly id: string;
  readonly label: string;
  readonly cli: string;
  readonly agents: readonly string[];
  readonly globalDir: string;
  readonly projectDir: string;
  readonly listModels: Effect.Effect<string[], CommandError>;
  readonly restartHint: string;
  readonly isAvailable?: Effect.Effect<boolean>;
}

const agentFilePath = (cfg: AgentFilePlatform, level: ModelConfigLevel, agent: string): string =>
  `${level === 'global' ? cfg.globalDir : cfg.projectDir}/${agent}.md`;

// oxlint-disable-next-line max-lines-per-function -- createAgentFileHandler is a cohesive factory for per-agent file handlers (pi/omp/cursor) sharing agentPath/resolveAgent and readCurrent/write for 7 agents. Splitting would fragment the single platform file-handling responsibility and create single-use helpers with one call site, hurting discoverability.
const createAgentFileHandler = (cfg: AgentFilePlatform): ModelConfigHandler => {
  const getAgentPath = (level: ModelConfigLevel, agent: string): string =>
    agentFilePath(cfg, level, agent);

  /**
   * Resolve the target file and its starting content for an agent.
   * At project level, falls back to the global agent file as the source
   * (the runtime merges project over global, so the file must be valid
   * standalone - copying the global content guarantees that).
   */
  const resolveAgent = (
    level: ModelConfigLevel,
    agent: string,
  ): Effect.Effect<{ path: string; content: string }, CommandError> => {
    const target = getAgentPath(level, agent);
    const global = getAgentPath('global', agent);
    return readFile(target)
      .pipe(
        Effect.catchCause(() =>
          level === 'global'
            ? Effect.fail(
                new CommandError({
                  command: `read ${target}`,
                  message: `Agent file not found at ${target}. Run 'maestria install ${cfg.id}' first.`,
                }),
              )
            : readFile(global).pipe(
                Effect.catchCause(() =>
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
      Effect.all(
        cfg.agents.map((a) =>
          resolveAgent(level, a).pipe(
            Effect.map(({ content }) => content),
            Effect.catchCause(() => Effect.succeed('')),
          ),
        ),
      ).pipe(
        Effect.map((contents) => {
          const result: AgentModels = {};
          for (let i = 0; i < cfg.agents.length; i += 1) {
            const agent = cfg.agents[i];
            if (agent === undefined || !isAgentName(agent)) {
              continue;
            }
            const model = parseFrontmatterModel(contents[i]);
            if (model !== undefined && model !== null && model !== '') {
              result[agent] = model;
            }
          }
          return result;
        }),
      ),
    restartHint: cfg.restartHint,
    write: (models, level) =>
      Effect.gen(function* write() {
        for (const [agent, model] of Object.entries(models)) {
          const { path: targetPath, content } = yield* resolveAgent(level, agent);
          yield* writeFile(targetPath, setFrontmatterModel(content, model ?? ''));
        }
      }),
  };
};

const pi = createAgentFileHandler({
  agents: MAESTRIA_AGENTS,
  cli: 'pi',
  globalDir: `${homedir()}/.pi/agent/agents`,
  id: 'pi',
  label: 'Pi',
  listModels: run('pi', ['--list-models'], 30_000).pipe(Effect.map(parsePiModels)),
  projectDir: '.pi/agents',
  restartHint: 'Start a new Pi session for the changes to take effect.',
});

const cursor = createAgentFileHandler({
  agents: MAESTRIA_AGENTS,
  cli: 'agent',
  // The plugin's generated agents are the global source. Project-level
  // configuration is written to Cursor's native `.cursor/agents` overlay.
  globalDir: `${homedir()}/.cursor/plugins/local/maestria/agents`,
  id: 'cursor',
  isAvailable: cursorConfigCli().pipe(Effect.map((cli) => cli !== undefined && cli !== '')),
  label: 'Cursor',
  listModels: listCursorModels(),
  projectDir: '.cursor/agents',
  restartHint: 'Start a new Cursor Agent session for the changes to take effect.',
});

const omp = createAgentFileHandler({
  agents: MAESTRIA_AGENTS,
  cli: 'omp',
  globalDir: `${homedir()}/.omp/agent/agents`,
  id: 'omp',
  label: 'Oh My Pi',
  listModels: run('omp', ['models', '--json'], 30_000).pipe(Effect.map(parseOmpModels)),
  projectDir: '.omp/agents',
  restartHint: 'Restart omp (or start a new session) for the changes to take effect.',
});

// ── Registry ──────────────────────────────────────────

export const modelConfigHandlers: readonly ModelConfigHandler[] = [
  opencode,
  codex,
  cursor,
  pi,
  omp,
];

export const getModelConfigHandler = (id: string): ModelConfigHandler | undefined =>
  modelConfigHandlers.find((h) => h.id === id);
