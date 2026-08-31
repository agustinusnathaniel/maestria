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
export function parseOpenCodeModels(out: string): string[] {
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\S+\/\S+$/u.test(line));
}

/** `pi --list-models` -> table with a header row */
export function parsePiModels(out: string): string[] {
  return out
    .split('\n')
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length >= 2 && parts[0] !== 'provider')
    .map((parts) => `${parts[0]}/${parts[1]}`);
}

/** `omp models --json` -> { models: [{ provider, id, selector, ... }] } */
export function parseOmpModels(out: string): string[] {
  try {
    const data: { models?: { selector?: string }[] } = JSON.parse(out);
    return (data.models ?? [])
      .map((m) => m.selector)
      .filter((s): s is string => typeof s === 'string' && s.length > 0);
  } catch {
    return [];
  }
}

/** `agent --list-models` -> one Cursor model id per line. */
export function parseCursorModels(out: string): string[] {
  try {
    const parsed: unknown = JSON.parse(out);
    const entries = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' &&
          parsed !== null &&
          Array.isArray((parsed as { models?: unknown }).models)
        ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
          (parsed as { models: unknown[] }).models
        : undefined;
    if (entries) {
      const models = entries.flatMap((entry) => {
        if (typeof entry === 'string') {
          return [entry];
        }
        if (typeof entry === 'object' && entry !== null) {
          const value =
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
            (entry as { id?: unknown; slug?: unknown; name?: unknown }).id ??
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
            (entry as { slug?: unknown }).slug ??
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
            (entry as { name?: unknown }).name;
          return typeof value === 'string' ? [value] : [];
        }
        return [];
      });
      if (models.length > 0) {
        return [...new Set(models)];
      }
    }
  } catch {
    // Cursor's human-readable output is the normal path.
  }

  const models: string[] = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    const match =
      /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\s+-\s+.*)?(?:\s+\((?:current|default)\))?$/u.exec(trimmed);
    if (
      match?.[1] !== undefined &&
      match?.[1] !== null &&
      match?.[1] !== '' &&
      !/^(available|models|filter)$/iu.test(match[1])
    ) {
      models.push(match[1]);
    }
  }
  return [...new Set(models)];
}

/** `codex debug models` -> model slugs from the native JSON catalog. */
export function parseCodexModels(out: string): string[] {
  try {
    const data: { models?: { slug?: unknown; id?: unknown }[] } = JSON.parse(out);
    return [
      ...new Set(
        (data.models ?? [])
          .map((model) => (typeof model.slug === 'string' ? model.slug : model.id))
          .filter((model): model is string => typeof model === 'string' && model.length > 0),
      ),
    ];
  } catch {
    return [];
  }
}

// ── Frontmatter helpers (pure) ────────────────────────

/** Extract the `model:` value from a markdown agent file's frontmatter */
export function parseFrontmatterModel(content: string): string | undefined {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(content);
  const block = fm?.[1] ?? content;
  const m = /^model:\s*(.+?)\s*$/mu.exec(block);
  return m?.[1];
}

/**
 * Set (or remove, when model is '') the `model:` key in a markdown
 * agent file's frontmatter. Preserves all other content byte-for-byte.
 */
export function setFrontmatterModel(content: string, model: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n?)/u.exec(content);
  if (!fm) {
    if (!model) {
      return content;
    }
    return `---\nmodel: ${model}\n---\n\n${content}`;
  }
  const [, fmBody, afterClosing] = fm;
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
}

// ── JSONC helpers (pure) ──────────────────────────────

const JSONC_OPTIONS = { formattingOptions: { insertSpaces: true, tabSize: 2 } } as const;

/**
 * Set (or remove, when model is '') `agent.<name>.model` in an
 * opencode config file. Preserves comments and formatting.
 */
export function setConfigModelJsonc(text: string, agent: string, model: string): string {
  if (!model && !hasConfigModel(text, agent)) {
    // jsonc-parser >= 3.3 throws when removing a non-existent path
    return text;
  }
  const edits = modify(text, ['agent', agent, 'model'], model || undefined, JSONC_OPTIONS);
  return applyEdits(text, edits);
}

function hasConfigModel(text: string, agent: string): boolean {
  const tree = parseTree(text);
  if (!tree) {
    return false;
  }
  return findNodeAtLocation(tree, ['agent', agent, 'model']) !== undefined;
}

/** Read `agent.<name>.model` values from an opencode config file */
export function parseConfigModels(text: string): AgentModels {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
    const obj = parse(text) as { agent?: Record<string, { model?: string }> };
    const result: AgentModels = {};
    for (const [name, cfg] of Object.entries(obj.agent ?? {})) {
      if (typeof cfg?.model === 'string' && cfg.model) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
        result[name as AgentName] = cfg.model;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ── Codex agent TOML helpers (pure) ────────────────────

/** Extract a top-level `model` value from a Codex custom-agent TOML file. */
export function parseCodexAgentModel(content: string): string | undefined {
  return parseCodexTopLevelString(content, 'model');
}

/** Set or remove a top-level `model` entry without rewriting other TOML text. */
export function setCodexAgentModel(content: string, model: string): string {
  return setCodexTopLevelString(content, 'model', model || undefined);
}

/** Create the smallest native Codex custom-agent file for a Maestria role. */
export function createCodexAgentConfig(
  agent: AgentName,
  model: string,
  nativeName = codexManagedAgentName(agent),
): string {
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
}

// ── FS helpers ────────────────────────────────────────

function readFile(path: string): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    catch: (error) => new CommandError({ command: `read ${path}`, message: String(error) }),
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      return await readFile(path, 'utf-8');
    },
  });
}

function writeFile(path: string, content: string): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
    catch: (error) => new CommandError({ command: `write ${path}`, message: String(error) }),
    try: async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
    },
  });
}

function fileExists(path: string): Effect.Effect<boolean> {
  return Effect.promise(async () => {
    const { stat } = await import('node:fs/promises');
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  });
}

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
function findOpenCodeConfigPath(level: ModelConfigLevel): Effect.Effect<string> {
  const candidates = level === 'global' ? OPENCODE_GLOBAL_CANDIDATES : OPENCODE_PROJECT_CANDIDATES;
  const fallback = level === 'global' ? OPENCODE_GLOBAL_CANDIDATES[0] : OPENCODE_PROJECT_CREATE;
  return Effect.all(candidates.map((p) => fileExists(p))).pipe(
    Effect.map((exists) => candidates[exists.indexOf(true)] ?? fallback),
  );
}

const opencode: ModelConfigHandler = {
  agents: MAESTRIA_AGENTS,
  cli: 'opencode',
  configLevels: ['global', 'project'],
  id: 'opencode',
  label: 'OpenCode',
  listModels: run('opencode', ['models'], 30_000).pipe(Effect.map(parseOpenCodeModels)),
  readCurrent: (level) =>
    findOpenCodeConfigPath(level).pipe(
      Effect.flatMap((path) => readFile(path).pipe(Effect.catchCause(() => Effect.succeed('')))),
      Effect.map(parseConfigModels),
    ),
  restartHint: 'Restart OpenCode (or reload the config) for the changes to take effect.',
  write: (models, level) =>
    Effect.gen(function* write() {
      const path = yield* findOpenCodeConfigPath(level);
      const text = yield* readFile(path).pipe(Effect.catchCause(() => Effect.succeed('{}')));
      let next = text;
      for (const [agent, model] of Object.entries(models)) {
        next = setConfigModelJsonc(next, agent, model ?? '');
      }
      yield* writeFile(path, next);
    }),
};

// ── Codex custom-agent handler ─────────────────────────

function codexHome(): string {
  return process.env.CODEX_HOME?.trim() ?? `${homedir()}/.codex`;
}

function codexAgentCandidates(level: ModelConfigLevel, agent: string): string[] {
  const directory = level === 'global' ? `${codexHome()}/agents` : '.codex/agents';
  return [`${directory}/${codexManagedAgentFileName(agent)}`, `${directory}/${agent}.toml`];
}

function resolveCodexAgentPath(level: ModelConfigLevel, agent: string): Effect.Effect<string> {
  const candidates = codexAgentCandidates(level, agent);
  return Effect.all(candidates.map((path) => fileExists(path))).pipe(
    Effect.map((exists) => candidates[exists.indexOf(true)] ?? candidates[0]),
  );
}

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
          Effect.flatMap((path) => readFile(path)),
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
        const path = yield* resolveCodexAgentPath(level, agent);
        const exists = yield* fileExists(path);
        if (!exists) {
          if (model) {
            yield* writeFile(
              path,
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
              createCodexAgentConfig(agent as AgentName, model, codexManagedAgentName(agent)),
            );
          }
          continue;
        }
        const content = yield* readFile(path);
        yield* writeFile(path, setCodexAgentModel(content, model ?? ''));
      }
    }),
};

// ── Cursor agent-file handler ─────────────────────────

function cursorConfigCli(): Effect.Effect<string | undefined> {
  return Effect.gen(function* () {
    if (yield* commandExists('cursor-agent')) {
      return 'cursor-agent';
    }
    if (!(yield* commandExists('agent'))) {
      return;
    }
    const version = yield* run('agent', ['--version'], 3000).pipe(
      Effect.catchCause(() => Effect.succeed('')),
    );
    return /cursor/iu.test(version) ? 'agent' : undefined;
  });
}

function cursorConfigCliOrFail(): Effect.Effect<string, CommandError> {
  return cursorConfigCli().pipe(
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
}

function listCursorModels(): Effect.Effect<string[], CommandError> {
  return cursorConfigCliOrFail().pipe(
    Effect.flatMap((cli) =>
      // `agent models` is the current command; retain the older flag as a
      // compatibility fallback for cursor-agent releases that still expose it.
      run(cli, ['models'], 30_000).pipe(
        Effect.catchCause(() => run(cli, ['--list-models'], 30_000)),
      ),
    ),
    Effect.map(parseCursorModels),
  );
}

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

function agentFilePath(cfg: AgentFilePlatform, level: ModelConfigLevel, agent: string): string {
  return `${level === 'global' ? cfg.globalDir : cfg.projectDir}/${agent}.md`;
}

// oxlint-disable-next-line max-lines-per-function -- createAgentFileHandler is a cohesive factory for per-agent file handlers (pi/omp/cursor) sharing agentPath/resolveAgent and readCurrent/write for 7 agents. Splitting would fragment the single platform file-handling responsibility and create single-use helpers with one call site, hurting discoverability.
function createAgentFileHandler(cfg: AgentFilePlatform): ModelConfigHandler {
  const agentPath = (level: ModelConfigLevel, agent: string): string =>
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
    const target = agentPath(level, agent);
    const global = agentPath('global', agent);
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
            const model = parseFrontmatterModel(contents[i]);
            if (model !== undefined && model !== null && model !== '') {
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown/union via runtime check, safe type assertion
              result[cfg.agents[i] as AgentName] = model;
            }
          }
          return result;
        }),
      ),
    restartHint: cfg.restartHint,
    write: (models, level) =>
      Effect.gen(function* write() {
        for (const [agent, model] of Object.entries(models)) {
          const { path, content } = yield* resolveAgent(level, agent);
          yield* writeFile(path, setFrontmatterModel(content, model ?? ''));
        }
      }),
  };
}

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
  id: 'cursor',
  label: 'Cursor',
  // The plugin's generated agents are the global source. Project-level
  // configuration is written to Cursor's native `.cursor/agents` overlay.
  globalDir: `${homedir()}/.cursor/plugins/local/maestria/agents`,
  projectDir: '.cursor/agents',
  cli: 'agent',
  agents: MAESTRIA_AGENTS,
  isAvailable: cursorConfigCli().pipe(Effect.map((cli) => cli !== undefined)),
  listModels: listCursorModels(),
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

export function getModelConfigHandler(id: string): ModelConfigHandler | undefined {
  return modelConfigHandlers.find((h) => h.id === id);
}
