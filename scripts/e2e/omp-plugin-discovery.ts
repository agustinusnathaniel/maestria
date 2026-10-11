#!/usr/bin/env bun
// Real-source discovery probe for the pinned OMP 18.4.8 host.
// Run with: pnpm exec bun scripts/e2e/omp-plugin-discovery.ts
// Optional: --host-root <installed OMP package directory> --out <artifact path>

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPackedPlugin } from './omp-plugin-package.ts';

const EXPECTED_HOST_VERSION = '18.4.8';
const PLUGIN_NAME = '@maestria/agent-plugins';
const EXPECTED_PLUGIN_COUNTS = { agents: 8, commands: 3, rules: 1, skills: 2 } as const;
const EXPECTED_AGENT_NAMES =
  'adventurer architect builder diagnose orchestrator planner reviewer writer'.split(' ');
const EXPECTED_SKILL_NAMES = ['handoff', 'iteration-limits'];
const scriptDir = import.meta.dirname;
const repoRoot = path.resolve(scriptDir, '../..');
const usage =
  'usage: bun scripts/e2e/omp-plugin-discovery.ts [--host-root <installed OMP package directory>] [--out <artifact path>]';

interface ProbeCheck {
  detail: string;
  name: string;
  pass: boolean;
}
interface PluginManifestFile {
  name: string;
  version: string;
  omp?: unknown;
  pi?: unknown;
}
interface DiscoveredItem {
  filePath?: string;
  name?: string;
  path?: string;
}
interface HostPlugin {
  enabled: boolean;
  name: string;
  version: string;
}
interface Provider<T extends DiscoveredItem> {
  id: string;
  load: (ctx: unknown) => Promise<{ items: T[]; warnings?: string[] }>;
}
interface CapabilityRegistry {
  getCapability: <T extends DiscoveredItem>(id: string) => { providers: Provider<T>[] } | undefined;
}
interface HostModules {
  discoverAgents: (
    cwd: string,
    home: string,
    extensionRoots: unknown,
  ) => Promise<{ agents: DiscoveredItem[] }>;
  getEnabledPlugins: (cwd: string, opts: { home: string }) => Promise<HostPlugin[]>;
  registry: CapabilityRegistry;
}
type ProviderResults = Record<
  'agentSkills' | 'commands' | 'legacySkills' | 'rules',
  DiscoveredItem[]
>;
interface Options {
  hostRoot: string;
  outPath: string;
}

const parseOptions = (argv: string[]): Options => {
  let hostRoot: string | undefined;
  let outPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help' || option === '-h') {
      process.stdout.write(`${usage}\n`);
      process.exit(0);
    }
    if (option !== '--host-root' && option !== '--out') {
      throw new Error(`${usage}\nunknown option: ${option}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${usage}\nmissing value for ${option}`);
    }
    if (option === '--host-root') {
      hostRoot = value;
    } else {
      outPath = value;
    }
    index += 1;
  }

  return {
    hostRoot: path.resolve(
      hostRoot ?? path.join(repoRoot, 'packages/omp/node_modules/@oh-my-pi/pi-coding-agent'),
    ),
    outPath: path.resolve(outPath ?? path.join(repoRoot, 'artifacts/omp-plugin-discovery.json')),
  };
};

const options = parseOptions(process.argv.slice(2));
const tempRoot = fs.mkdtempSync(path.join(tmpdir(), 'omp-plugin-discovery-'));
const checks: ProbeCheck[] = [];
const counts: Record<keyof typeof EXPECTED_PLUGIN_COUNTS, number | null> = {
  agents: null,
  commands: null,
  rules: null,
  skills: null,
};
const discoveryCounts: Record<string, typeof counts> = {};
let hostVersion: string | null = null;
let pluginVersion: string | null = null;
let failure: string | null = null;
let discoverySurface = '';

const normalize = (value: string): string => value.split(tempRoot).join('<TMP>');

const recordCheck = (name: string, pass: boolean, detail = ''): void => {
  checks.push({
    detail: normalize(detail),
    name: discoverySurface ? `${discoverySurface}: ${name}` : name,
    pass,
  });
  if (!pass) {
    throw new Error(`${name}: ${detail || 'check failed'}`);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPluginManifest = (value: unknown): value is PluginManifestFile =>
  isRecord(value) && typeof value.name === 'string' && typeof value.version === 'string';

const readPluginManifest = (filePath: string): PluginManifestFile => {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!isPluginManifest(parsed)) {
    throw new Error(`invalid plugin package manifest: ${filePath}`);
  }
  return parsed;
};

const isWithin = (candidate: string | undefined, parent: string): boolean => {
  if (candidate === undefined) {
    return false;
  }
  const relative = path.relative(parent, path.resolve(candidate));
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
};

const sameNames = (actual: string[], expected: string[]): boolean =>
  actual.length === expected.length && expected.every((name) => actual.includes(name));

const importHostModule = async (
  hostRoot: string,
  relativePath: string,
): Promise<Record<string, unknown>> => {
  const loaded: unknown = await import(pathToFileURL(path.join(hostRoot, relativePath)).href);
  if (!isRecord(loaded)) {
    throw new Error(`host module has no exports: ${relativePath}`);
  }
  return loaded;
};

const isCapabilityRegistry = (
  value: Record<string, unknown>,
): value is CapabilityRegistry & Record<string, unknown> =>
  typeof value.getCapability === 'function';

const isTaskDiscoveryModule = (
  value: Record<string, unknown>,
): value is Record<string, unknown> & Pick<HostModules, 'discoverAgents'> =>
  typeof value.discoverAgents === 'function';

const isPluginLoaderModule = (
  value: Record<string, unknown>,
): value is Record<string, unknown> & Pick<HostModules, 'getEnabledPlugins'> =>
  typeof value.getEnabledPlugins === 'function';

const loadHostModules = async (hostRoot: string): Promise<HostModules> => {
  const capabilityModule = await importHostModule(hostRoot, 'src/capability/index.ts');
  await importHostModule(hostRoot, 'src/discovery/omp-plugins.ts');
  await importHostModule(hostRoot, 'src/discovery/agent-plugins.ts');
  const taskModule = await importHostModule(hostRoot, 'src/task/discovery.ts');
  const loaderModule = await importHostModule(hostRoot, 'src/extensibility/plugins/loader.ts');
  if (!isCapabilityRegistry(capabilityModule)) {
    throw new Error('OMP source lacks getCapability');
  }
  if (!isTaskDiscoveryModule(taskModule)) {
    throw new Error('OMP source lacks discoverAgents');
  }
  if (!isPluginLoaderModule(loaderModule)) {
    throw new Error('OMP source lacks getEnabledPlugins');
  }
  return {
    discoverAgents: taskModule.discoverAgents,
    getEnabledPlugins: loaderModule.getEnabledPlugins,
    registry: capabilityModule,
  };
};

const pluginRootFor = (home: string): string => path.join(home, '.omp', 'plugins');

const installFixturePackage = (
  home: string,
  cwd: string,
  packedPackageRoot: string,
  manifest: PluginManifestFile,
): string => {
  const pluginRoot = pluginRootFor(home);
  const installedPackageRoot = path.join(pluginRoot, 'node_modules', ...PLUGIN_NAME.split('/'));
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(
    path.join(pluginRoot, 'package.json'),
    `${JSON.stringify(
      {
        dependencies: { [PLUGIN_NAME]: manifest.version },
        name: 'omp-plugin-discovery-fixture',
        private: true,
      },
      null,
      2,
    )}\n`,
  );
  fs.mkdirSync(path.dirname(installedPackageRoot), { recursive: true });
  fs.cpSync(packedPackageRoot, installedPackageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(installedPackageRoot, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return installedPackageRoot;
};

const checkPluginRegistration = async (
  fixtureRoot: string,
  getEnabledPlugins: HostModules['getEnabledPlugins'],
  packedPackageRoot: string,
  manifest: PluginManifestFile,
): Promise<{ cwd: string; home: string; packageRoot: string }> => {
  const positiveHome = path.join(fixtureRoot, 'positive-home');
  const positiveCwd = path.join(fixtureRoot, 'positive-cwd');
  const negativeHome = path.join(fixtureRoot, 'negative-home');
  const negativeCwd = path.join(fixtureRoot, 'negative-cwd');
  const packageRoot = installFixturePackage(positiveHome, positiveCwd, packedPackageRoot, manifest);
  const negativeManifest = { ...manifest };
  delete negativeManifest.omp;
  installFixturePackage(negativeHome, negativeCwd, packedPackageRoot, negativeManifest);

  const registeredPlugins = await getEnabledPlugins(positiveCwd, { home: positiveHome });
  const registeredPlugin = registeredPlugins.find((plugin) => plugin.name === PLUGIN_NAME);
  recordCheck(
    'packed plugin registers with OMP metadata',
    registeredPlugin?.version === manifest.version && registeredPlugin.enabled,
    registeredPlugin
      ? `${registeredPlugin.name} ${registeredPlugin.version}`
      : 'the installed package was absent from getEnabledPlugins',
  );
  const pluginsWithoutOmp = await getEnabledPlugins(negativeCwd, { home: negativeHome });
  recordCheck(
    'same package without omp metadata is not registered',
    !pluginsWithoutOmp.some((plugin) => plugin.name === PLUGIN_NAME),
    pluginsWithoutOmp.map((plugin) => plugin.name).join(', ') || 'no enabled plugins',
  );
  return { cwd: positiveCwd, home: positiveHome, packageRoot };
};

const getProvider = <T extends DiscoveredItem>(
  host: HostModules,
  capabilityId: string,
  providerId: string,
): Provider<T> => {
  const provider = host.registry
    .getCapability<T>(capabilityId)
    ?.providers.find((candidate) => candidate.id === providerId);
  if (!provider) {
    throw new Error(`OMP source did not register ${providerId} for ${capabilityId}`);
  }
  return provider;
};

const loadProviderResults = async (host: HostModules, ctx: unknown): Promise<ProviderResults> => {
  const [agentSkills, legacySkills, commands, rules] = await Promise.all([
    getProvider<DiscoveredItem>(host, 'skills', 'agent-plugins').load(ctx),
    getProvider<DiscoveredItem>(host, 'skills', 'omp-plugins').load(ctx),
    getProvider<DiscoveredItem>(host, 'slash-commands', 'omp-plugins').load(ctx),
    getProvider<DiscoveredItem>(host, 'rules', 'omp-plugins').load(ctx),
  ]);
  return {
    agentSkills: agentSkills.items,
    commands: commands.items,
    legacySkills: legacySkills.items,
    rules: rules.items,
  };
};

const checkSkillDiscovery = (skills: DiscoveredItem[], legacySkills: DiscoveredItem[]): void => {
  counts.skills = skills.length;
  recordCheck(
    'portable skills load from packed plugin',
    counts.skills === EXPECTED_PLUGIN_COUNTS.skills && legacySkills.length === 0,
    `agent-plugins=${counts.skills}, legacy omp-plugins=${legacySkills.length}; expected ${EXPECTED_PLUGIN_COUNTS.skills} and 0`,
  );
  const skillNames = skills
    .map((skill) => skill.name)
    .filter((name): name is string => typeof name === 'string')
    .toSorted();
  recordCheck(
    'all packed skills are present',
    sameNames(skillNames, EXPECTED_SKILL_NAMES),
    skillNames.join(', '),
  );
};

const checkAgentDiscovery = async (
  host: HostModules,
  fixture: { cwd: string; home: string; packageRoot: string },
  extensionRoots: unknown,
): Promise<void> => {
  const discovered = await host.discoverAgents(fixture.cwd, fixture.home, extensionRoots);
  const rootAgents = discovered.agents.filter((agent) =>
    isWithin(agent.filePath, fixture.packageRoot),
  );
  counts.agents = rootAgents.length;
  recordCheck(
    'root agents load from packed plugin',
    counts.agents === EXPECTED_PLUGIN_COUNTS.agents,
    `found ${counts.agents}; expected ${EXPECTED_PLUGIN_COUNTS.agents}`,
  );
  const agentNames = rootAgents
    .map((agent) => agent.name)
    .filter((name): name is string => typeof name === 'string')
    .toSorted();
  recordCheck(
    'all packed root roles are present',
    sameNames(agentNames, EXPECTED_AGENT_NAMES),
    agentNames.join(', '),
  );
};

const checkPackedDiscovery = async (
  host: HostModules,
  fixture: { cwd: string; home: string; packageRoot: string },
): Promise<void> => {
  const extensionRoots = {
    configured: [],
    configuredLevel: 'user',
    explicit: [fixture.packageRoot],
    mode: 'explicit-only',
  } as const;
  const ctx = {
    cwd: fixture.cwd,
    extensionRoots,
    home: fixture.home,
    repoRoot: null,
  };
  const results = await loadProviderResults(host, ctx);
  const skills = results.agentSkills.filter((skill) => isWithin(skill.path, fixture.packageRoot));
  const legacySkills = results.legacySkills.filter((skill) =>
    isWithin(skill.path, fixture.packageRoot),
  );
  const commands = results.commands.filter((command) =>
    isWithin(command.path, fixture.packageRoot),
  );
  const rules = results.rules.filter((rule) => isWithin(rule.path, fixture.packageRoot));
  recordCheck(
    'provider results are fixture-local',
    skills.length === results.agentSkills.length &&
      legacySkills.length === results.legacySkills.length &&
      commands.length === results.commands.length &&
      rules.length === results.rules.length,
    'discovery returned an item outside the packed plugin root',
  );
  counts.commands = commands.length;
  counts.rules = rules.length;
  checkSkillDiscovery(skills, legacySkills);
  await checkAgentDiscovery(host, fixture, extensionRoots);
  recordCheck(
    'native commands and always-apply policy are discovered',
    counts.commands === EXPECTED_PLUGIN_COUNTS.commands &&
      counts.rules === EXPECTED_PLUGIN_COUNTS.rules,
    `commands=${counts.commands}, rules=${counts.rules}; expected 3 commands and 1 rule`,
  );
};

const probe = async (): Promise<void> => {
  const hostPackagePath = path.join(options.hostRoot, 'package.json');
  if (!fs.existsSync(hostPackagePath)) {
    throw new Error(
      `missing OMP host package at ${options.hostRoot}; install @oh-my-pi/pi-coding-agent or pass --host-root with its installed package directory`,
    );
  }
  const hostPackage = readPluginManifest(hostPackagePath);
  hostVersion = hostPackage.version;
  recordCheck(
    'pinned host package',
    hostPackage.name === '@oh-my-pi/pi-coding-agent' && hostVersion === EXPECTED_HOST_VERSION,
    `${hostPackage.name} ${hostVersion}; expected @oh-my-pi/pi-coding-agent ${EXPECTED_HOST_VERSION}`,
  );
  const missingSources = [
    'src/capability/index.ts',
    'src/discovery/omp-plugins.ts',
    'src/discovery/agent-plugins.ts',
    'src/task/discovery.ts',
    'src/extensibility/plugins/loader.ts',
  ].filter((relativePath) => !fs.existsSync(path.join(options.hostRoot, relativePath)));
  recordCheck(
    'required host sources exist',
    missingSources.length === 0,
    missingSources.length === 0
      ? 'all source APIs exist'
      : `${missingSources.join(', ')} under ${options.hostRoot}; pass --host-root with the installed OMP package source directory`,
  );

  let host: HostModules;
  try {
    host = await loadHostModules(options.hostRoot);
  } catch (error) {
    throw new Error(
      `could not import pinned OMP source from ${options.hostRoot}: ${String(error)}. Confirm host dependencies are installed or pass --host-root.`,
      { cause: error },
    );
  }

  const packed = loadPackedPlugin(repoRoot, tempRoot, recordCheck);
  pluginVersion = packed.manifest.version;
  const fixture = await checkPluginRegistration(
    tempRoot,
    host.getEnabledPlugins,
    packed.packageRoot,
    packed.manifest,
  );
  discoverySurface = 'archive';
  await checkPackedDiscovery(host, fixture);
  discoveryCounts.archive = { ...counts };
  const gitFixture = {
    cwd: path.join(tempRoot, 'git-cwd'),
    home: path.join(tempRoot, 'git-home'),
    packageRoot: path.join(repoRoot, 'packages/agent-plugins'),
  };
  fs.mkdirSync(gitFixture.cwd, { recursive: true });
  fs.mkdirSync(gitFixture.home, { recursive: true });
  discoverySurface = 'git root';
  await checkPackedDiscovery(host, gitFixture);
  discoveryCounts.gitRoot = { ...counts };
};

try {
  await probe();
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  checks.push({ detail: normalize(failure), name: 'probe completed', pass: false });
} finally {
  const artifact = {
    checks,
    counts,
    discoveryCounts,
    host: {
      name: '@oh-my-pi/pi-coding-agent',
      version: hostVersion,
    },
    pass: failure === null && checks.every((check) => check.pass),
    plugin: {
      name: PLUGIN_NAME,
      version: pluginVersion,
    },
    ...(failure === null ? {} : { error: normalize(failure) }),
  };
  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  fs.rmSync(tempRoot, { force: true, recursive: true });
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  if (!artifact.pass) {
    process.exitCode = 1;
  }
}
