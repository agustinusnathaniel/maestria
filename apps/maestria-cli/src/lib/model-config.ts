import { Effect } from 'effect';
import { homedir } from 'os';
// Import the ESM build directly - the UMD entry does runtime `require('./impl/*')`
// calls that the bundler does not inline.
import {
  modify,
  applyEdits,
  parse,
  parseTree,
  findNodeAtLocation,
} from 'jsonc-parser/lib/esm/main.js';
import { run, CommandError } from '@/lib/shell.js';

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
    .filter((line) => /^\S+\/\S+$/.test(line));
}

/** `pi --list-models` -> table with a header row */
export function parsePiModels(out: string): string[] {
  return out
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
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

// ── Frontmatter helpers (pure) ────────────────────────

/** Extract the `model:` value from a markdown agent file's frontmatter */
export function parseFrontmatterModel(content: string): string | undefined {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  const block = fm?.[1] ?? content;
  const m = /^model:\s*(.+?)\s*$/m.exec(block);
  return m?.[1];
}

/**
 * Set (or remove, when model is '') the `model:` key in a markdown
 * agent file's frontmatter. Preserves all other content byte-for-byte.
 */
export function setFrontmatterModel(content: string, model: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n?)/.exec(content);
  if (!fm) {
    if (!model) return content;
    return `---\nmodel: ${model}\n---\n\n${content}`;
  }
  const [, fmBody, afterClosing] = fm;
  const rest = content.slice(fm[0].length);
  const lines = fmBody.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith('model:'));
  if (model) {
    if (idx >= 0) {
      lines[idx] = `model: ${model}`;
    } else {
      lines.push(`model: ${model}`);
    }
  } else if (idx >= 0) {
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
  const edits = modify(text, ['agent', agent, 'model'], model ? model : undefined, JSONC_OPTIONS);
  return applyEdits(text, edits);
}

function hasConfigModel(text: string, agent: string): boolean {
  const tree = parseTree(text);
  if (!tree) return false;
  return findNodeAtLocation(tree, ['agent', agent, 'model']) !== undefined;
}

/** Read `agent.<name>.model` values from an opencode config file */
export function parseConfigModels(text: string): AgentModels {
  try {
    const obj = parse(text) as { agent?: Record<string, { model?: string }> };
    const result: AgentModels = {};
    for (const [name, cfg] of Object.entries(obj.agent ?? {})) {
      if (typeof cfg?.model === 'string' && cfg.model) {
        result[name as AgentName] = cfg.model;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ── FS helpers ────────────────────────────────────────

function readFile(path: string): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { readFile } = await import('node:fs/promises');
      return await readFile(path, 'utf-8');
    },
    catch: (error) => new CommandError({ command: `read ${path}`, message: String(error) }),
  });
}

function writeFile(path: string, content: string): Effect.Effect<void, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
    },
    catch: (error) => new CommandError({ command: `write ${path}`, message: String(error) }),
  });
}

function fileExists(path: string): Effect.Effect<boolean, never> {
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
function findOpenCodeConfigPath(level: ModelConfigLevel): Effect.Effect<string, never> {
  const candidates = level === 'global' ? OPENCODE_GLOBAL_CANDIDATES : OPENCODE_PROJECT_CANDIDATES;
  const fallback = level === 'global' ? OPENCODE_GLOBAL_CANDIDATES[0] : OPENCODE_PROJECT_CREATE;
  return Effect.all(candidates.map((p) => fileExists(p))).pipe(
    Effect.map((exists) => candidates[exists.indexOf(true)] ?? fallback),
  );
}

const opencode: ModelConfigHandler = {
  id: 'opencode',
  label: 'OpenCode',
  cli: 'opencode',
  agents: MAESTRIA_AGENTS,
  configLevels: ['global', 'project'],
  restartHint: 'Restart OpenCode (or reload the config) for the changes to take effect.',

  listModels: run('opencode', ['models'], 30_000).pipe(Effect.map(parseOpenCodeModels)),

  readCurrent: (level) =>
    findOpenCodeConfigPath(level).pipe(
      Effect.flatMap((path) => readFile(path).pipe(Effect.catchCause(() => Effect.succeed('')))),
      Effect.map(parseConfigModels),
    ),

  write: (models, level) =>
    Effect.gen(function* () {
      const path = yield* findOpenCodeConfigPath(level);
      const text = yield* readFile(path).pipe(Effect.catchCause(() => Effect.succeed('{}')));
      let next = text;
      for (const [agent, model] of Object.entries(models)) {
        next = setConfigModelJsonc(next, agent, model ?? '');
      }
      yield* writeFile(path, next);
    }),
};

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
}

function createAgentFileHandler(cfg: AgentFilePlatform): ModelConfigHandler {
  const agentPath = (level: ModelConfigLevel, agent: string): string =>
    `${level === 'global' ? cfg.globalDir : cfg.projectDir}/${agent}.md`;

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
      .pipe(Effect.map((content) => ({ path: target, content })));
  };

  return {
    id: cfg.id,
    label: cfg.label,
    cli: cfg.cli,
    agents: MAESTRIA_AGENTS,
    configLevels: ['global', 'project'],
    restartHint: cfg.restartHint,
    listModels: cfg.listModels,

    readCurrent: (level) =>
      Effect.all(
        cfg.agents.map((a) =>
          readFile(agentPath(level, a)).pipe(Effect.catchCause(() => Effect.succeed(''))),
        ),
      ).pipe(
        Effect.map((contents) => {
          const result: AgentModels = {};
          for (let i = 0; i < cfg.agents.length; i++) {
            const model = parseFrontmatterModel(contents[i]);
            if (model) {
              result[cfg.agents[i] as AgentName] = model;
            }
          }
          return result;
        }),
      ),

    write: (models, level) =>
      Effect.gen(function* () {
        for (const [agent, model] of Object.entries(models)) {
          const { path, content } = yield* resolveAgent(level, agent);
          yield* writeFile(path, setFrontmatterModel(content, model ?? ''));
        }
      }),
  };
}

const pi = createAgentFileHandler({
  id: 'pi',
  label: 'Pi',
  cli: 'pi',
  agents: MAESTRIA_AGENTS,
  globalDir: `${homedir()}/.pi/agent/agents`,
  projectDir: '.pi/agents',
  listModels: run('pi', ['--list-models'], 30_000).pipe(Effect.map(parsePiModels)),
  restartHint: 'Start a new Pi session for the changes to take effect.',
});

const omp = createAgentFileHandler({
  id: 'omp',
  label: 'Oh My Pi',
  cli: 'omp',
  agents: MAESTRIA_AGENTS,
  globalDir: `${homedir()}/.omp/agent/agents`,
  projectDir: '.omp/agents',
  listModels: run('omp', ['models', '--json'], 30_000).pipe(Effect.map(parseOmpModels)),
  restartHint: 'Restart omp (or start a new session) for the changes to take effect.',
});

// ── Registry ──────────────────────────────────────────

export const modelConfigHandlers: readonly ModelConfigHandler[] = [opencode, pi, omp];

export function getModelConfigHandler(id: string): ModelConfigHandler | undefined {
  return modelConfigHandlers.find((h) => h.id === id);
}
