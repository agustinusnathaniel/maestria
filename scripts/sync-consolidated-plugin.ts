#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import {
  normalizeLineEndings,
  serializeFrontmatter,
  stripFrontmatter,
} from '../packages/core/scripts/lib/transforms.js';

const ROLES = ['adventurer', 'architect', 'builder', 'diagnose', 'planner', 'reviewer', 'writer'];
const MODES = ['fein', 'sonar', 'blitz'];
const UTILITIES = ['handoff', 'iteration-limits'];
const HOSTS = ['claude-code', 'codex', 'cursor', 'devin', 'hermes', 'kimi-code', 'omp', 'zcode'];
const NOTICE =
  '<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->';
const MANIFESTS = [
  ['generation/manifests/plugin.json', 'plugin.json'],
  ['generation/manifests/claude-code.json', '.claude-plugin/plugin.json'],
  ['generation/manifests/codex.json', '.codex-plugin/plugin.json'],
  ['generation/manifests/cursor.json', '.cursor-plugin/plugin.json'],
  ['generation/manifests/devin.json', '.devin-plugin/plugin.json'],
  ['generation/manifests/zcode.json', '.zcode-plugin/plugin.json'],
  ['generation/manifests/kimi.plugin.json', 'kimi.plugin.json'],
] as const;
const RETIRED_OUTPUTS = [
  ...[...ROLES, ...MODES, 'orchestrator', 'global-rules'].map((name) => `skills/${name}/SKILL.md`),
  ...MODES.map((mode) => `commands/modes/${mode}.md`),
  'rules/global/global-rules.md',
  'skills/handoff.md',
  'skills/iteration-limits.md',
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertContainedFile = (root: string, relative: string): string => {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Resource escapes package root: ${relative}`);
  }
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(`Plugin resource must not be a symlink: ${relative}`);
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }
  return absolute;
};

const readInput = (root: string, relative: string): string => {
  const absolute = assertContainedFile(root, relative);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Required plugin input is missing or not a file: ${relative}`);
  }
  return normalizeLineEndings(fs.readFileSync(absolute, 'utf-8'));
};

const document = (body: string, metadata: Record<string, unknown> | null = null): string =>
  `${serializeFrontmatter(metadata)}\n${NOTICE}\n\n${body.trim()}\n`;
const compose = (...parts: string[]): string => parts.map((part) => part.trim()).join('\n\n');

interface Inputs {
  arguments: string;
  contexts: Record<string, string>;
  modes: Record<string, { body: string; metadata: Record<string, unknown> }>;
  roles: Record<string, string>;
  rules: string;
  utilities: Record<string, string>;
}

const requiredHeading = (source: string, heading: string, label: string): void => {
  if (!source.includes(heading)) {
    throw new Error(`Missing canonical heading ${heading}: ${label}`);
  }
};

const readMode = (coreRoot: string, mode: string): Inputs['modes'][string] => {
  const source = readInput(coreRoot, `commands/${mode}.md`);
  const frontmatter = /^---\n(?<metadata>[\s\S]*?)\n---\n/u.exec(source)?.groups?.metadata;
  const metadata: unknown = parse(frontmatter ?? '');
  if (!isRecord(metadata) || metadata.name !== mode || typeof metadata.description !== 'string') {
    throw new Error(`Invalid canonical mode frontmatter: ${mode}`);
  }
  requiredHeading(source, `[MODE: ${mode}]`, mode);
  return { body: stripFrontmatter(source), metadata };
};

const integrationDisplayName = (host: string): string => {
  if (host === 'claude-code') {
    return 'Claude Code';
  }
  if (host === 'codex') {
    return 'Codex CLI';
  }
  if (host === 'omp') {
    return 'OMP';
  }
  if (host === 'zcode') {
    return 'ZCode';
  }
  return `${host.charAt(0).toUpperCase()}${host.slice(1)}`;
};

const integrationHeading = (host: string): string => {
  if (host === 'kimi-code') {
    return '## Specialist → Subagent Routing';
  }
  if (host === 'cursor') {
    return '## Specialist Agents (Cursor)';
  }
  return `## ${integrationDisplayName(host)} Integration`;
};

const readCanonicalInputs = (repoRoot: string): Inputs => {
  const coreRoot = path.resolve(repoRoot, 'packages/core/agent-directives');
  const roles = Object.fromEntries(
    [...ROLES, 'orchestrator'].map((role) => [role, readInput(coreRoot, `specialists/${role}.md`)]),
  );
  const contexts = Object.fromEntries(
    HOSTS.map((host) => [host, readInput(coreRoot, `integrations/${host}.md`)]),
  );
  const rules = readInput(coreRoot, 'rules.md');
  requiredHeading(rules, '## Universal Floors', 'rules.md');
  requiredHeading(roles.orchestrator, '## Routing', 'specialists/orchestrator.md');
  for (const host of HOSTS) {
    requiredHeading(contexts[host], integrationHeading(host), `integrations/${host}.md`);
  }
  const args = readInput(coreRoot, 'integrations/command-arguments.md');
  requiredHeading(args, '$ARGUMENTS', 'integrations/command-arguments.md');
  readInput(coreRoot, 'agents/claude-wrapper.md');
  const codexInstructions = readInput(coreRoot, 'integrations/codex-instructions.md');
  requiredHeading(
    codexInstructions,
    '<!-- maestria:codex-orchestrator:start -->',
    'codex-instructions.md',
  );
  requiredHeading(
    codexInstructions,
    '<!-- maestria:codex-orchestrator:end -->',
    'codex-instructions.md',
  );
  return {
    arguments: args,
    contexts,
    modes: Object.fromEntries(MODES.map((mode) => [mode, readMode(coreRoot, mode)])),
    roles,
    rules,
    utilities: Object.fromEntries(
      UTILITIES.map((name) => [name, readInput(coreRoot, `skills/${name}.md`)]),
    ),
  };
};

const addOutput = (plan: Map<string, string>, relative: string, content: string): void => {
  if (plan.has(relative)) {
    throw new Error(`Duplicate plugin output path: ${relative}`);
  }
  plan.set(relative, content);
};

const profileMetadata = (packageRoot: string): Record<string, Record<string, unknown>> => {
  const value: unknown = JSON.parse(readInput(packageRoot, 'generation/profiles.json'));
  if (!isRecord(value)) {
    throw new Error('Invalid profile registry');
  }
  const profiles: Record<string, Record<string, unknown>> = {};
  for (const role of [...ROLES, 'orchestrator']) {
    const profile = value[role];
    if (!isRecord(profile) || profile.name !== role || typeof profile.description !== 'string') {
      throw new Error(`Invalid profile metadata: ${role}`);
    }
    profiles[role] = profile;
  }
  return profiles;
};

const addProfiles = (plan: Map<string, string>, packageRoot: string, input: Inputs): void => {
  const profiles = profileMetadata(packageRoot);
  for (const role of [...ROLES, 'orchestrator']) {
    addOutput(
      plan,
      `agents/${role}.md`,
      document(compose(input.roles[role], input.rules), profiles[role]),
    );
    if (role === 'orchestrator') {
      continue;
    }
    const readOnly = ['adventurer', 'planner', 'reviewer'].includes(role);
    const body = compose(input.roles[role], input.rules);
    addOutput(
      plan,
      `agents/claude-code/${role}.md`,
      document(body, {
        ...profiles[role],
        model: 'inherit',
        ...(readOnly ? { disallowedTools: 'Write, Edit' } : {}),
      }),
    );
    addOutput(
      plan,
      `agents/cursor/${role}.md`,
      document(body, { ...profiles[role], ...(readOnly ? { readonly: true } : {}) }),
    );
    addOutput(
      plan,
      `agents/kimi-code/${role}.md`,
      document(body, {
        ...profiles[role],
        ...(readOnly ? { disallowedTools: ['WriteFile', 'StrReplaceFile'] } : {}),
        subagents: [],
      }),
    );
    const native = readInput(packageRoot, `generation/codex/maestria-${role}.toml`);
    if (
      !native.includes(`name = "maestria-${role}"`) ||
      native.includes('developer_instructions')
    ) {
      throw new Error(`Invalid native Codex metadata: ${role}`);
    }
    const instructions = compose(body, input.contexts.codex);
    if (instructions.includes('"""')) {
      throw new Error(`Unsupported TOML instruction delimiter: ${role}`);
    }
    addOutput(
      plan,
      `agents/codex/maestria-${role}.toml`,
      `${native.trim()}\n\n# Generated from canonical core directives.\ndeveloper_instructions = """\n${instructions.replaceAll('\\', '\\\\')}\n"""\n`,
    );
  }
};

const addPolicyRules = (plan: Map<string, string>, input: Inputs, routerPolicy: string): void => {
  addOutput(
    plan,
    'rules/global.md',
    document(compose(routerPolicy, input.contexts.omp), {
      alwaysApply: true,
      description: 'Maestria global policy and main-session workflow routing',
    }),
  );
  addOutput(
    plan,
    'rules/cursor/maestria-global.mdc',
    document(compose(routerPolicy, input.contexts.cursor), {
      alwaysApply: true,
      description: 'Maestria global policy and Cursor workflow routing',
    }),
  );
};

const addSessionContexts = (plan: Map<string, string>, input: Inputs, complete: string): void => {
  addOutput(plan, 'AGENTS.md', document(compose(complete, input.contexts.devin)));
  addOutput(plan, 'rules/hermes/context.md', document(compose(complete, input.contexts.hermes)));
  const kimi = document(compose(complete, input.contexts['kimi-code']));
  if (Buffer.byteLength(kimi) > 32 * 1024) {
    throw new Error('Kimi bootstrap exceeds the documented 32 KB system prompt limit');
  }
  addOutput(plan, 'rules/kimi-code/bootstrap.md', kimi);
  addOutput(
    plan,
    'rules/codex/instructions/AGENTS.md',
    `<!-- maestria:codex-orchestrator:start -->\n\n${document(compose(complete, input.contexts.codex))}\n<!-- maestria:codex-orchestrator:end -->\n`,
  );
};

const addModeCommands = (plan: Map<string, string>, input: Inputs, routerPolicy: string): void => {
  for (const mode of MODES) {
    const { body, metadata } = input.modes[mode];
    const command = compose(body, routerPolicy, input.arguments);
    addOutput(
      plan,
      `commands/${mode}.md`,
      document(command, { description: metadata.description, name: mode }),
    );
    for (const host of ['cursor', 'kimi-code']) {
      addOutput(
        plan,
        `commands/${host}/${mode}.md`,
        document(compose(command, input.contexts[host]), {
          description: metadata.description,
          name: mode,
        }),
      );
    }
    addOutput(
      plan,
      `compatibility/devin/skills/${mode}/SKILL.md`,
      document(compose(command, input.contexts.devin), {
        description: metadata.description,
        name: mode,
      }),
    );
  }
};

const utilityDescription = (utility: string): string => {
  if (utility === 'handoff') {
    return 'Pass outcome, constraints, evidence, blockers, and next steps between workflow stages';
  }
  return 'Bound repair and stop repeated work using verifiable termination criteria';
};

const addUtilitySkills = (plan: Map<string, string>, input: Inputs): void => {
  for (const utility of UTILITIES) {
    const source = input.utilities[utility];
    addOutput(
      plan,
      `skills/${utility}/SKILL.md`,
      document(stripFrontmatter(source), {
        description: utilityDescription(utility),
        name: utility,
      }),
    );
  }
};

const addIntegrationReadmes = (plan: Map<string, string>, input: Inputs): void => {
  for (const host of HOSTS) {
    addOutput(plan, `integrations/${host}/README.md`, document(input.contexts[host]));
  }
};

const addContexts = (plan: Map<string, string>, input: Inputs): void => {
  const routerPolicy = compose(input.roles.orchestrator, input.rules);
  const complete = compose(routerPolicy, ...MODES.map((mode) => input.modes[mode].body));
  addPolicyRules(plan, input, routerPolicy);
  addSessionContexts(plan, input, complete);
  addModeCommands(plan, input, routerPolicy);
  addUtilitySkills(plan, input);
  addIntegrationReadmes(plan, input);
};

const validateManifestResources = (packageRoot: string, plan: Map<string, string>): void => {
  for (const [, output] of MANIFESTS) {
    const manifest: unknown = JSON.parse(plan.get(output) ?? '');
    if (!isRecord(manifest)) {
      throw new Error(`Invalid plugin manifest: ${output}`);
    }
    for (const field of ['skills', 'agents', 'commands', 'rules', 'systemPromptPath']) {
      const selected = manifest[field];
      const relatives: unknown[] = [];
      if (Array.isArray(selected)) {
        for (const item of selected) {
          relatives.push(item);
        }
      } else if (selected !== undefined) {
        relatives.push(selected);
      }
      for (const relative of relatives) {
        if (typeof relative !== 'string') {
          throw new TypeError(`Invalid ${field} selector in ${output}`);
        }
        const normalized = relative.replace(/^\.\//u, '').replace(/\/$/u, '');
        assertContainedFile(packageRoot, normalized);
        if (
          !plan.has(normalized) &&
          ![...plan.keys()].some((key) => key.startsWith(`${normalized}/`))
        ) {
          throw new Error(`Unreachable ${field} resource in ${output}: ${relative}`);
        }
      }
    }
  }
};

const outputPlan = (repoRoot: string): Map<string, string> => {
  const packageRoot = path.resolve(repoRoot, 'packages/agent-plugins');
  const input = readCanonicalInputs(repoRoot);
  const plan = new Map<string, string>();
  for (const [source, output] of MANIFESTS) {
    addOutput(plan, output, readInput(packageRoot, source));
  }
  addProfiles(plan, packageRoot, input);
  addContexts(plan, input);
  validateManifestResources(packageRoot, plan);
  return plan;
};

const validateOutputPaths = (repoRoot: string, plan: Map<string, string>): void => {
  const packageRoot = path.resolve(repoRoot, 'packages/agent-plugins');
  for (const relative of [...plan.keys(), ...RETIRED_OUTPUTS]) {
    const absolute = assertContainedFile(packageRoot, relative);
    if (fs.existsSync(absolute) && !fs.statSync(absolute).isFile()) {
      throw new Error(`Plugin resource is not a file: ${relative}`);
    }
  }
};

export const preflightPluginPaths = (repoRoot: string): void => {
  validateOutputPaths(repoRoot, outputPlan(repoRoot));
};

const pruneEmptyParents = (packageRoot: string, relative: string): void => {
  let directory = path.dirname(path.join(packageRoot, relative));
  while (
    directory !== packageRoot &&
    fs.existsSync(directory) &&
    fs.readdirSync(directory).length === 0
  ) {
    fs.rmdirSync(directory);
    directory = path.dirname(directory);
  }
};

export const syncConsolidatedPlugin = (repoRoot: string, check = false): string[] => {
  const packageRoot = path.resolve(repoRoot, 'packages/agent-plugins');
  const plan = outputPlan(repoRoot);
  validateOutputPaths(repoRoot, plan);
  const stale = RETIRED_OUTPUTS.filter((relative) =>
    fs.existsSync(path.join(packageRoot, relative)),
  );
  const changed = [...plan]
    .filter(
      ([relative, content]) =>
        !fs.existsSync(path.join(packageRoot, relative)) ||
        fs.readFileSync(path.join(packageRoot, relative), 'utf-8') !== content,
    )
    .map(([relative]) => relative);
  if (!check) {
    for (const relative of changed) {
      const absolute = path.join(packageRoot, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, plan.get(relative) ?? '', 'utf-8');
    }
    for (const relative of stale) {
      fs.unlinkSync(path.join(packageRoot, relative));
      pruneEmptyParents(packageRoot, relative);
    }
  }
  return [...changed, ...stale].toSorted();
};

export const main = (
  args: string[],
  repoRoot = path.resolve(import.meta.dirname, '..'),
): number => {
  if (
    args.length > 1 ||
    (args.length === 1 && !['--check', '--write', '--preflight'].includes(args[0]))
  ) {
    console.error('Usage: sync-consolidated-plugin.ts [--check|--write|--preflight]');
    return 2;
  }
  try {
    if (args[0] === '--preflight') {
      preflightPluginPaths(repoRoot);
      return 0;
    }
    const check = args[0] === '--check';
    const changes = syncConsolidatedPlugin(repoRoot, check);
    for (const relative of changes) {
      console.log(`${check ? 'DRIFT' : 'SYNC'}: packages/agent-plugins/${relative}`);
    }
    return check && changes.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = main(process.argv.slice(2));
}
