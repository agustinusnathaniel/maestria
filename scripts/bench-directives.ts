import { execFileSync } from 'node:child_process';
import { accessSync, constants, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = 'scripts/fixtures/directive-benchmark.json';
const ROUTES = ['direct', 'focused', 'full', 'fein', 'sonar', 'blitz'] as const;
const PLATFORMS = ['cursor', 'hermes', 'kimi-code', 'omp', 'opencode', 'pi'] as const;
const SYNC_CONFIGS = PLATFORMS.map((platform) => `packages/${platform}/sync.config.ts`);
const CANONICAL_SOURCES = [
  'packages/core/agent-directives/commands/blitz.md',
  'packages/core/agent-directives/commands/fein.md',
  'packages/core/agent-directives/commands/sonar.md',
  'packages/core/agent-directives/rules.md',
  'packages/core/agent-directives/skills/handoff.md',
  'packages/core/agent-directives/skills/iteration-limits.md',
  'packages/core/agent-directives/specialists/adventurer.md',
  'packages/core/agent-directives/specialists/architect.md',
  'packages/core/agent-directives/specialists/builder.md',
  'packages/core/agent-directives/specialists/diagnose.md',
  'packages/core/agent-directives/specialists/orchestrator.md',
  'packages/core/agent-directives/specialists/planner.md',
  'packages/core/agent-directives/specialists/reviewer.md',
  'packages/core/agent-directives/specialists/writer.md',
] as const;
const COMMANDS = ['blitz', 'fein', 'sonar'] as const;
const SPECIALISTS = [
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'orchestrator',
  'planner',
  'reviewer',
  'writer',
] as const;
const GENERATED_OUTPUTS = [
  ...COMMANDS.map((name) => ({
    source: `packages/core/agent-directives/commands/${name}.md`,
    output: `packages/cursor/commands/${name}.md`,
    platform: 'cursor',
  })),
  {
    source: 'packages/core/agent-directives/rules.md',
    output: 'packages/cursor/rules/maestria-global.mdc',
    platform: 'cursor',
  },
  ...SPECIALISTS.map((name) => ({
    source: `packages/core/agent-directives/specialists/${name}.md`,
    output:
      name === 'orchestrator'
        ? 'packages/cursor/skills/orchestrator/SKILL.md'
        : `packages/cursor/agents/${name}.md`,
    platform: 'cursor',
  })),
  ...COMMANDS.map((name) => ({
    source: `packages/core/agent-directives/commands/${name}.md`,
    output: `packages/hermes/src/maestria_hermes/skills/commands/${name}/SKILL.md`,
    platform: 'hermes',
  })),
  {
    source: 'packages/core/agent-directives/rules.md',
    output: 'packages/hermes/src/maestria_hermes/skills/global-rules/SKILL.md',
    platform: 'hermes',
  },
  ...SPECIALISTS.map((name) => ({
    source: `packages/core/agent-directives/specialists/${name}.md`,
    output: `packages/hermes/src/maestria_hermes/skills/${name}/SKILL.md`,
    platform: 'hermes',
  })),
  ...COMMANDS.map((name) => ({
    source: `packages/core/agent-directives/commands/${name}.md`,
    output: `packages/kimi-code/skills/commands/${name}/SKILL.md`,
    platform: 'kimi-code',
  })),
  ...SPECIALISTS.map((name) => ({
    source: `packages/core/agent-directives/specialists/${name}.md`,
    output: `packages/kimi-code/skills/${name}/SKILL.md`,
    platform: 'kimi-code',
  })),
  ...COMMANDS.map((name) => ({
    source: `packages/core/agent-directives/commands/${name}.md`,
    output: `packages/omp/agents/commands/${name}.md`,
    platform: 'omp',
  })),
  {
    source: 'packages/core/agent-directives/rules.md',
    output: 'packages/omp/agents/.gitkeep',
    platform: 'omp',
  },
  {
    source: 'packages/core/agent-directives/rules.md',
    output: 'packages/omp/skills/global-rules/SKILL.md',
    platform: 'omp',
  },
  {
    source: 'packages/core/agent-directives/skills/handoff.md',
    output: 'packages/omp/skills/handoff/SKILL.md',
    platform: 'omp',
  },
  {
    source: 'packages/core/agent-directives/skills/iteration-limits.md',
    output: 'packages/omp/skills/iteration-limits/SKILL.md',
    platform: 'omp',
  },
  ...SPECIALISTS.map((name) => ({
    source: `packages/core/agent-directives/specialists/${name}.md`,
    output:
      name === 'orchestrator'
        ? 'packages/omp/skills/orchestrator/SKILL.md'
        : `packages/omp/agents/${name}.md`,
    platform: 'omp',
  })),
  ...COMMANDS.map((name) => ({
    source: `packages/core/agent-directives/commands/${name}.md`,
    output: `packages/pi/agents/commands/${name}.md`,
    platform: 'pi',
  })),
  {
    source: 'packages/core/agent-directives/rules.md',
    output: 'packages/pi/skills/global-rules/.gitkeep',
    platform: 'pi',
  },
  {
    source: 'packages/core/agent-directives/rules.md',
    output: 'packages/pi/skills/global-rules/SKILL.md',
    platform: 'pi',
  },
  {
    source: 'packages/core/agent-directives/skills/handoff.md',
    output: 'packages/pi/skills/handoff/SKILL.md',
    platform: 'pi',
  },
  {
    source: 'packages/core/agent-directives/skills/iteration-limits.md',
    output: 'packages/pi/skills/iteration-limits/SKILL.md',
    platform: 'pi',
  },
  ...SPECIALISTS.map((name) => ({
    source: `packages/core/agent-directives/specialists/${name}.md`,
    output:
      name === 'orchestrator'
        ? 'packages/pi/skills/orchestrator/SKILL.md'
        : `packages/pi/agents/${name}.md`,
    platform: 'pi',
  })),
  ...COMMANDS.map((name) => ({
    source: `packages/core/agent-directives/commands/${name}.md`,
    output: `packages/opencode/agents/commands/${name}.md`,
    platform: 'opencode',
  })),
  ...SPECIALISTS.map((name) => ({
    source: `packages/core/agent-directives/specialists/${name}.md`,
    output: `packages/opencode/agents/${name}.md`,
    platform: 'opencode',
  })),
] as const;
export type Route = (typeof ROUTES)[number];
export type EffectiveRoute = 'direct' | 'focused' | 'full' | 'research-only';

export interface SizeMetrics {
  bytes: number;
  characters: number;
  lines: number;
  estimatedTokens: number;
}

export interface RouteEnvelope {
  schemaVersion: 1;
  mode: 'none' | 'fein' | 'sonar' | 'blitz';
  route: EffectiveRoute;
  allowedRoutes: string[];
  implementationPermission: 'allowed' | 'conditional' | 'forbidden';
  reviewFloor:
    | 'none'
    | 'non-trivial-builder-change'
    | 'after-each-builder-change'
    | 'safety-triggered';
  safetyFloor: 'always-required';
  possibleSpecialistClasses: string[];
  selection: 'fixed' | 'conditional';
  safetyEscalationRoutes: string[];
  stopCondition: string;
}

interface Manifest {
  schemaVersion: 1;
  identity: string;
  canonicalSources: string[];
  generatedOutputs: Array<{ source: string; output: string; platform: string }>;
  syncConfigs: string[];
  duplicationProbes: { canonical: string[]; generated: string[] };
  routeCases: Route[];
}

interface SnapshotInput {
  read(path: string): string;
  manifest: Manifest;
}

export interface SnapshotReport {
  canonical: SizeMetrics;
  canonicalInventory: string[];
  canonicalFiles: Record<string, SizeMetrics>;
  generated: Record<string, SizeMetrics>;
  generatedFiles: Record<string, SizeMetrics>;
  generatedTotal: SizeMetrics;
  duplicationProbes: { canonical: Record<string, number>; generated: Record<string, number> };
  routeModeEnvelopes: Record<Route, SizeMetrics>;
  generatedInventory: Record<string, string[]>;
  files: { canonical: number; generated: number };
}

export interface BenchmarkReport {
  schemaVersion: 1;
  manifest: { path: string; identity: string; schemaVersion: 1 };
  measurement: {
    tokenProxy: 'ceil(non-whitespace Unicode code points / 4)';
    characterMetric: 'Unicode code points';
    lineMetric: 'logical lines; trailing newline does not add an empty line';
    perFileAggregation: 'fileEstimatedTokens is rounded per file; aggregateEstimatedTokens sums file estimates';
    providerTokenUsage: 'unavailable';
    latency: 'unavailable';
    quality: 'unavailable';
    cost: 'unavailable';
    humanOutput: 'summary only; JSON contains complete details';
  };
  comparison: { baseline: string; candidate: string; revision?: string };
  baseline: SnapshotReport;
  candidate: SnapshotReport;
  delta: {
    canonical: Record<keyof SizeMetrics, number>;
    generatedTotal: Record<keyof SizeMetrics, number>;
  };
}

const CONTRACT_PHRASES = [
  '!!!',
  'Validate before handoff',
  'Handoff Contract',
  'maker/checker split',
  'verifiable termination',
];

export function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/');
}

export function platformForPath(path: string): string {
  return normalizeRelativePath(path).split('/')[1] ?? 'unknown';
}

export function validatePath(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`${field} must be a non-empty path`);
  const path = normalizeRelativePath(value);
  if (path.startsWith('/') || /^[A-Za-z]:/u.test(path) || path.startsWith('//')) {
    throw new Error(`${field} must be a relative POSIX path: ${value}`);
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${field} contains an invalid path segment: ${value}`);
  }
  return segments.join('/');
}

function assertInsideRoot(root: string, path: string, field: string): void {
  const lexical = resolve(root, path);
  const lexicalRelative = relative(root, lexical);
  if (lexicalRelative === '..' || lexicalRelative.startsWith('../'))
    throw new Error(`${field} escapes selected root: ${path}`);
  try {
    if (lstatSync(lexical).isSymbolicLink())
      throw new Error(`${field} must not be a symlink: ${path}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('must not be a symlink')) throw error;
    throw new Error(`${field} is missing or unreadable: ${path}`);
  }
  let real: string;
  try {
    real = realpathSync(lexical);
  } catch {
    throw new Error(`${field} is missing or unreadable: ${path}`);
  }
  const rootReal = realpathSync(root);
  const realRelative = relative(rootReal, real);
  if (realRelative === '..' || realRelative.startsWith('../'))
    throw new Error(`${field} escapes selected root through a symlink: ${path}`);
  try {
    accessSync(real, constants.R_OK);
    if (!lstatSync(real).isFile()) throw new Error(`${field} is not a readable file: ${path}`);
  } catch {
    throw new Error(`${field} is missing or unreadable: ${path}`);
  }
}

function unique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${field} contains duplicate paths`);
}

function exactSet(actual: readonly string[], expected: readonly string[], field: string): void {
  if (
    actual.length !== expected.length ||
    [...actual].sort().join('\0') !== [...expected].sort().join('\0')
  )
    throw new Error(`${field} must contain the exact inventory (${expected.length} entries)`);
}

function validateManifestStructure(raw: unknown): Manifest {
  if (!raw || typeof raw !== 'object') throw new Error('Manifest must be an object');
  const value = raw as Record<string, unknown>;
  const knownFields = new Set([
    'schemaVersion',
    'identity',
    'canonicalSources',
    'generatedOutputs',
    'syncConfigs',
    'duplicationProbes',
    'routeCases',
  ]);
  for (const field of Object.keys(value))
    if (!knownFields.has(field)) throw new Error(`Unknown manifest field: ${field}`);
  if (value.schemaVersion !== 1) throw new Error('Unsupported manifest schema version');
  if (typeof value.identity !== 'string' || value.identity.length === 0)
    throw new Error('Manifest identity is required');
  const list = (key: string): string[] => {
    if (!Array.isArray(value[key]) || value[key].length === 0)
      throw new Error(`${key} must be a non-empty list`);
    return (value[key] as unknown[]).map((entry, index) => validatePath(entry, `${key}[${index}]`));
  };
  const canonicalSources = list('canonicalSources');
  const syncConfigs = list('syncConfigs');
  const probes = value.duplicationProbes;
  if (!probes || typeof probes !== 'object') throw new Error('duplicationProbes is required');
  const probeValue = probes as Record<string, unknown>;
  for (const field of Object.keys(probeValue))
    if (field !== 'canonical' && field !== 'generated')
      throw new Error(`Unknown duplicationProbes field: ${field}`);
  const canonicalProbes = Array.isArray(probeValue.canonical)
    ? (probeValue.canonical as unknown[]).map((x, i) =>
        validatePath(x, `duplicationProbes.canonical[${i}]`),
      )
    : [];
  const generatedProbes = Array.isArray(probeValue.generated)
    ? (probeValue.generated as unknown[]).map((x, i) =>
        validatePath(x, `duplicationProbes.generated[${i}]`),
      )
    : [];
  if (!canonicalProbes.length || !generatedProbes.length)
    throw new Error('duplication probes must be non-empty lists');
  const generatedRaw = value.generatedOutputs;
  if (!Array.isArray(generatedRaw) || generatedRaw.length === 0)
    throw new Error('generatedOutputs must be a non-empty list');
  const generatedOutputs = generatedRaw.map((entry, index) => {
    if (!entry || typeof entry !== 'object')
      throw new Error(`generatedOutputs[${index}] must be an object`);
    const item = entry as Record<string, unknown>;
    for (const field of Object.keys(item))
      if (field !== 'source' && field !== 'output' && field !== 'platform')
        throw new Error(`Unknown generatedOutputs[${index}] field: ${field}`);
    return {
      source: validatePath(item.source, `generatedOutputs[${index}].source`),
      output: validatePath(item.output, `generatedOutputs[${index}].output`),
      platform:
        typeof item.platform === 'string' && item.platform
          ? item.platform
          : (() => {
              throw new Error(`generatedOutputs[${index}].platform is required`);
            })(),
    };
  });
  unique(canonicalSources, 'canonicalSources');
  unique(syncConfigs, 'syncConfigs');
  unique(canonicalProbes, 'duplicationProbes.canonical');
  unique(generatedProbes, 'duplicationProbes.generated');
  unique(
    generatedOutputs.map((x) => x.output),
    'generatedOutputs',
  );
  exactSet(canonicalSources, CANONICAL_SOURCES, 'canonicalSources');
  if (!generatedOutputs.every((x) => canonicalSources.includes(x.source)))
    throw new Error('Every generated source must be in canonicalSources');
  if (
    !generatedOutputs.every(
      (x) =>
        (PLATFORMS as readonly string[]).includes(x.platform) &&
        platformForPath(x.output) === x.platform,
    )
  )
    throw new Error('generatedOutputs contains an unknown or mismatched platform');
  const outputs = generatedOutputs.map((x) => x.output);
  if (!canonicalProbes.every((path) => canonicalSources.includes(path)))
    throw new Error('Canonical duplication probes must reference canonicalSources');
  if (!generatedProbes.every((path) => outputs.includes(path)))
    throw new Error('Generated duplication probes must reference generatedOutputs');
  if (syncConfigs.some((path) => !(SYNC_CONFIGS as readonly string[]).includes(path)))
    throw new Error('syncConfigs contains an unknown platform configuration');
  exactSet(syncConfigs, SYNC_CONFIGS, 'syncConfigs');
  const routeCases = value.routeCases;
  if (
    !Array.isArray(routeCases) ||
    routeCases.length !== ROUTES.length ||
    [...routeCases].sort((a, b) => String(a).localeCompare(String(b))).join(',') !==
      [...ROUTES].sort((a, b) => a.localeCompare(b)).join(',')
  )
    throw new Error('routeCases must contain all known routes exactly once');
  unique(routeCases as string[], 'routeCases');
  const expectedGenerated = GENERATED_OUTPUTS.map(
    (entry) => `${entry.source}\0${entry.output}\0${entry.platform}`,
  );
  exactSet(
    generatedOutputs.map((entry) => `${entry.source}\0${entry.output}\0${entry.platform}`),
    expectedGenerated,
    'generatedOutputs',
  );
  return {
    schemaVersion: 1,
    identity: value.identity,
    canonicalSources,
    generatedOutputs,
    syncConfigs,
    duplicationProbes: { canonical: canonicalProbes, generated: generatedProbes },
    routeCases: [...routeCases] as Route[],
  };
}

function validateManifestSources(manifest: Manifest, root: string): void {
  for (const path of [
    ...manifest.canonicalSources,
    ...manifest.generatedOutputs.flatMap((x) => [x.output, x.source]),
    ...manifest.syncConfigs,
    ...manifest.duplicationProbes.canonical,
    ...manifest.duplicationProbes.generated,
  ])
    assertInsideRoot(root, path, 'Manifest path');
}

export function validateManifest(raw: unknown, root: string): Manifest {
  const manifest = validateManifestStructure(raw);
  validateManifestSources(manifest, root);
  return manifest;
}

function readFile(root: string, path: string): string {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch {
    throw new Error(`Manifest-listed file is missing or unreadable: ${path}`);
  }
}

function gitFile(root: string, revision: string, path: string): string | undefined {
  try {
    return execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, encoding: 'utf8' });
  } catch {
    return undefined;
  }
}

function validateGitFile(root: string, revision: string, path: string): void {
  try {
    const tree = execFileSync('git', ['ls-tree', '-z', revision, '--', path], {
      cwd: root,
      encoding: 'utf8',
    });
    const entry = tree.split('\0').find(Boolean);
    if (!entry) throw new Error('missing');
    const [mode, type] = entry.split('\t', 1)[0]!.split(' ');
    if (type !== 'blob' || mode === '120000') throw new Error('not a regular file');
  } catch {
    throw new Error(`Revision ${revision} is missing or unreadable manifest-listed file: ${path}`);
  }
}

function revisionExists(root: string, revision: string): void {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${revision}^{commit}`], {
      cwd: root,
      stdio: 'ignore',
    });
  } catch {
    throw new Error(`Invalid git revision: ${revision}`);
  }
}

function manifestFromRoot(root: string): Manifest {
  return validateManifest(JSON.parse(readFile(root, MANIFEST_PATH)), root);
}

function manifestFromRevision(root: string, revision: string): Manifest {
  const text = gitFile(root, revision, MANIFEST_PATH);
  if (text === undefined) throw new Error(`Revision ${revision} is missing ${MANIFEST_PATH}`);
  const raw = JSON.parse(text);
  const manifest = validateManifestStructure(raw);
  for (const path of [
    ...manifest.canonicalSources,
    ...manifest.generatedOutputs.flatMap((x) => [x.output, x.source]),
    ...manifest.syncConfigs,
    ...manifest.duplicationProbes.canonical,
    ...manifest.duplicationProbes.generated,
  ])
    validateGitFile(root, revision, path);
  return manifest;
}

function compareRevision(
  root: string,
  revision: string,
  current: Manifest,
  historical: Manifest,
): void {
  if (current.identity !== historical.identity)
    throw new Error(`Cannot compare revision ${revision}: manifest identity differs`);
  if (
    current.syncConfigs.length !== historical.syncConfigs.length ||
    current.syncConfigs.some((path, i) => path !== historical.syncConfigs[i])
  )
    throw new Error(
      `Cannot compare revision ${revision}: sync configuration inputs differ from the working tree`,
    );
  for (const path of current.syncConfigs)
    if (readFile(root, path) !== gitFile(root, revision, path))
      throw new Error(
        `Cannot compare revision ${revision}: sync configuration inputs differ from the working tree`,
      );
}

export function metrics(text: string): SizeMetrics {
  const characters = Array.from(text).length;
  const nonWhitespace = Array.from(text).filter((character) => !/\s/u.test(character)).length;
  return {
    bytes: Buffer.byteLength(text),
    characters,
    lines: text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0),
    estimatedTokens: Math.ceil(nonWhitespace / 4),
  };
}

function add(left: SizeMetrics, right: SizeMetrics): SizeMetrics {
  return {
    bytes: left.bytes + right.bytes,
    characters: left.characters + right.characters,
    lines: left.lines + right.lines,
    estimatedTokens: left.estimatedTokens + right.estimatedTokens,
  };
}
function zero(): SizeMetrics {
  return { bytes: 0, characters: 0, lines: 0, estimatedTokens: 0 };
}
function count(paths: string[], read: (path: string) => string): Record<string, number> {
  return Object.fromEntries(
    CONTRACT_PHRASES.map((phrase) => [
      phrase,
      paths.reduce((total, path) => total + read(path).split(phrase).length - 1, 0),
    ]),
  );
}

export function routeEnvelope(route: Route): RouteEnvelope {
  if (route === 'direct')
    return {
      schemaVersion: 1,
      mode: 'none',
      route: 'direct',
      allowedRoutes: ['direct'],
      implementationPermission: 'allowed',
      reviewFloor: 'none',
      safetyFloor: 'always-required',
      possibleSpecialistClasses: [],
      selection: 'fixed',
      safetyEscalationRoutes: ['focused', 'full'],
      stopCondition: 'Complete the direct task and verify it.',
    };
  if (route === 'focused')
    return {
      schemaVersion: 1,
      mode: 'none',
      route: 'focused',
      allowedRoutes: ['focused'],
      implementationPermission: 'conditional',
      reviewFloor: 'non-trivial-builder-change',
      safetyFloor: 'always-required',
      possibleSpecialistClasses: ['one-targeted-specialist-class'],
      selection: 'conditional',
      safetyEscalationRoutes: ['full'],
      stopCondition: 'Stop after the targeted output and required review.',
    };
  if (route === 'sonar')
    return {
      schemaVersion: 1,
      mode: 'sonar',
      route: 'research-only',
      allowedRoutes: ['research-only'],
      implementationPermission: 'forbidden',
      reviewFloor: 'none',
      safetyFloor: 'always-required',
      possibleSpecialistClasses: [
        'owning-research-specialist',
        'optional-distinct-research-specialist',
      ],
      selection: 'conditional',
      safetyEscalationRoutes: [],
      stopCondition: 'Stop after research outputs; do not implement.',
    };
  if (route === 'blitz')
    return {
      schemaVersion: 1,
      mode: 'blitz',
      route: 'direct',
      allowedRoutes: ['direct'],
      implementationPermission: 'allowed',
      reviewFloor: 'safety-triggered',
      safetyFloor: 'always-required',
      possibleSpecialistClasses: [
        'implementation',
        'optional-reconnaissance',
        'optional-safety-review',
      ],
      selection: 'conditional',
      safetyEscalationRoutes: ['focused', 'full'],
      stopCondition: 'Stop after implementation and safety-triggered review when required.',
    };
  const mode = route === 'fein' ? 'fein' : 'none';
  return {
    schemaVersion: 1,
    mode,
    route: 'full',
    allowedRoutes: ['full'],
    implementationPermission: 'allowed',
    reviewFloor: 'after-each-builder-change',
    safetyFloor: 'always-required',
    possibleSpecialistClasses: [
      'reconnaissance',
      'architecture',
      'planning',
      'diagnosis',
      'implementation',
      'review',
      'documentation',
    ],
    selection: 'conditional',
    safetyEscalationRoutes: [],
    stopCondition: 'Stop after the full pipeline and each required review.',
  };
}

function snapshot(input: SnapshotInput): SnapshotReport {
  const canonicalFiles = Object.fromEntries(
    input.manifest.canonicalSources.map((path) => [path, metrics(input.read(path))]),
  );
  const generatedFiles = Object.fromEntries(
    input.manifest.generatedOutputs.map(({ output }) => [output, metrics(input.read(output))]),
  );
  const generatedInventory: Record<string, string[]> = {};
  for (const item of input.manifest.generatedOutputs)
    (generatedInventory[item.platform] ??= []).push(item.output);
  const generated = Object.fromEntries(
    Object.entries(generatedInventory)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([platform, paths]) => [
        platform,
        paths.reduce((total, path) => add(total, generatedFiles[path]!), zero()),
      ]),
  );
  return {
    canonical: input.manifest.canonicalSources.reduce(
      (total, path) => add(total, canonicalFiles[path]!),
      zero(),
    ),
    canonicalInventory: input.manifest.canonicalSources,
    canonicalFiles,
    generated,
    generatedFiles,
    generatedTotal: input.manifest.generatedOutputs.reduce(
      (total, { output }) => add(total, generatedFiles[output]!),
      zero(),
    ),
    duplicationProbes: {
      canonical: count(input.manifest.duplicationProbes.canonical, (path) => input.read(path)),
      generated: count(input.manifest.duplicationProbes.generated, (path) => input.read(path)),
    },
    routeModeEnvelopes: Object.fromEntries(
      ROUTES.map((route) => [route, metrics(JSON.stringify(routeEnvelope(route)))]),
    ) as Record<Route, SizeMetrics>,
    generatedInventory,
    files: {
      canonical: input.manifest.canonicalSources.length,
      generated: input.manifest.generatedOutputs.length,
    },
  };
}

function delta(left: SizeMetrics, right: SizeMetrics): Record<keyof SizeMetrics, number> {
  return {
    bytes: right.bytes - left.bytes,
    characters: right.characters - left.characters,
    lines: right.lines - left.lines,
    estimatedTokens: right.estimatedTokens - left.estimatedTokens,
  };
}

export async function buildReport(
  revision?: string,
  root = DEFAULT_ROOT,
): Promise<BenchmarkReport> {
  const selectedRoot = realpathSync(resolve(root));
  const currentManifest = manifestFromRoot(selectedRoot);
  const candidate: SnapshotInput = {
    manifest: currentManifest,
    read: (path) => readFile(selectedRoot, path),
  };
  let baseline = candidate;
  if (revision) {
    revisionExists(selectedRoot, revision);
    const historical = manifestFromRevision(selectedRoot, revision);
    compareRevision(selectedRoot, revision, currentManifest, historical);
    baseline = {
      manifest: historical,
      read: (path) => {
        const text = gitFile(selectedRoot, revision, path);
        if (text === undefined)
          throw new Error(
            `Cannot compare revision ${revision}: baseline file is missing (${path})`,
          );
        return text;
      },
    };
  }
  const candidateReport = snapshot(candidate);
  const baselineReport = snapshot(baseline);
  return {
    schemaVersion: 1,
    manifest: { path: MANIFEST_PATH, identity: currentManifest.identity, schemaVersion: 1 },
    measurement: {
      tokenProxy: 'ceil(non-whitespace Unicode code points / 4)',
      characterMetric: 'Unicode code points',
      lineMetric: 'logical lines; trailing newline does not add an empty line',
      perFileAggregation:
        'fileEstimatedTokens is rounded per file; aggregateEstimatedTokens sums file estimates',
      providerTokenUsage: 'unavailable',
      latency: 'unavailable',
      quality: 'unavailable',
      cost: 'unavailable',
      humanOutput: 'summary only; JSON contains complete details',
    },
    comparison: {
      baseline: revision ?? 'working-tree',
      candidate: 'working-tree',
      ...(revision ? { revision } : {}),
    },
    baseline: baselineReport,
    candidate: candidateReport,
    delta: {
      canonical: delta(baselineReport.canonical, candidateReport.canonical),
      generatedTotal: delta(baselineReport.generatedTotal, candidateReport.generatedTotal),
    },
  };
}

export function parseArgs(args: string[]): {
  help: boolean;
  json: boolean;
  revision?: string;
  root?: string;
} {
  let help = false;
  let json = false;
  let revision: string | undefined;
  let root: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--json') json = true;
    else if (arg === '--revision' || arg === '--root') {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`);
      if (arg === '--revision') revision = value;
      else root = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return { help, json, ...(revision ? { revision } : {}), ...(root ? { root } : {}) };
}

function printHelp(): void {
  console.log(
    'Usage: pnpm bench:directives [--json] [--revision <git-revision>] [--root <directory>]',
  );
  console.log(
    'The explicit manifest is authoritative. Human output is summary-only; JSON contains complete details.',
  );
}
function printHuman(report: BenchmarkReport): void {
  console.log(
    `Directive benchmark: ${report.comparison.baseline} -> ${report.comparison.candidate}`,
  );
  console.log(
    `Canonical: ${report.candidate.canonical.estimatedTokens} estimated tokens across ${report.candidate.files.canonical} files`,
  );
  console.log(
    `Generated: ${report.candidate.generatedTotal.estimatedTokens} estimated tokens across ${report.candidate.files.generated} files`,
  );
  console.log('Provider token usage, latency, quality, and cost: unavailable (offline harness).');
}

if (import.meta.main) {
  try {
    const { help, json, revision, root } = parseArgs(process.argv.slice(2));
    if (help) printHelp();
    else {
      const report = await buildReport(revision, root);
      if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      else printHuman(report);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
