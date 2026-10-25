#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import {
  extractSection,
  normalizeLineEndings,
  serializeFrontmatter,
  stripFrontmatter,
} from '../packages/core/scripts/lib/transforms.js';

const ROLES = ['adventurer', 'architect', 'builder', 'reviewer'];
// rules.md is split into `# ` parts; each specialist profile embeds only the parts its role acts on,
// because subagents on several hosts never see the main session's always-on rules.
const RULE_PARTS = ['Every Agent', 'Implementation and Review', 'Writing Changes', 'Main Session'];
const ROLE_RULE_PARTS: Record<string, readonly string[]> = {
  adventurer: ['Every Agent'],
  architect: ['Every Agent'],
  builder: ['Every Agent', 'Implementation and Review', 'Writing Changes'],
  reviewer: ['Every Agent', 'Implementation and Review'],
};
const MODES = ['fein', 'sonar', 'blitz'];
const UTILITIES = ['handoff', 'iteration-limits'] as const;
// Each utility skill projects one rules.md section, so it cannot drift from policy.
const UTILITY_SECTIONS: Record<(typeof UTILITIES)[number], string> = {
  handoff: 'Delegation and Context',
  'iteration-limits': 'Bounded Repair and Fail-Loud Behavior',
};
// Hosts whose canonical integration note is composed into a shipped rule, context, or profile.
const HOSTS = ['codex', 'cursor', 'devin', 'hermes', 'kimi-code', 'omp'];
export const GENERATED_NOTICE =
  '<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->';
export const TOML_NOTICE = '# Generated from canonical core directives.';
const ROOT_MANIFESTS = [
  'plugin.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
  '.devin-plugin/plugin.json',
  '.zcode-plugin/plugin.json',
  'kimi.plugin.json',
] as const;
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
  `${serializeFrontmatter(metadata)}\n${GENERATED_NOTICE}\n\n${body.trim()}\n`;
const compose = (...parts: string[]): string => parts.map((part) => part.trim()).join('\n\n');

interface Inputs {
  arguments: string;
  contexts: Record<string, string>;
  modes: Record<string, { body: string; metadata: Record<string, unknown> }>;
  roleRules: Record<string, string>;
  roles: Record<string, string>;
  rules: string;
  utilities: Record<string, string>;
}

const requiredHeading = (source: string, heading: string, label: string): void => {
  if (!source.includes(heading)) {
    throw new Error(`Missing canonical heading ${heading}: ${label}`);
  }
};

const splitRuleParts = (rules: string): { parts: Map<string, string>; preamble: string } => {
  const lines = rules.split('\n');
  const starts = lines.flatMap((line, index) =>
    index > 0 && line.startsWith('# ') ? [index] : [],
  );
  const parts = new Map<string, string>();
  for (const [position, start] of starts.entries()) {
    const name = lines[start].slice(2).trim();
    if (parts.has(name) || !RULE_PARTS.includes(name)) {
      throw new Error(`Unexpected or duplicate rules.md part: # ${name}`);
    }
    parts.set(name, lines.slice(start, starts[position + 1]).join('\n'));
  }
  if ([...parts.keys()].join('\n') !== RULE_PARTS.join('\n')) {
    throw new Error(`rules.md must contain the parts ${RULE_PARTS.join(', ')} in order`);
  }
  return { parts, preamble: lines.slice(0, starts[0]).join('\n') };
};

const roleRules = (rules: string): Record<string, string> => {
  const { parts, preamble } = splitRuleParts(rules);
  return Object.fromEntries(
    ROLES.map((role) => [
      role,
      compose(preamble, ...ROLE_RULE_PARTS[role].map((part) => parts.get(part) ?? '')),
    ]),
  );
};

const utilitySection = (rules: string, heading: string): string => {
  const section = extractSection(rules, heading);
  if (section === null) {
    throw new Error(`Missing canonical heading ## ${heading}: rules.md`);
  }
  return section;
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
  if (host === 'codex') {
    return 'Codex CLI';
  }
  if (host === 'omp') {
    return 'OMP';
  }
  if (host === 'kimi-code') {
    return 'Kimi Code';
  }
  return `${host.charAt(0).toUpperCase()}${host.slice(1)}`;
};

const integrationHeading = (host: string): string => {
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
  return {
    arguments: args,
    contexts,
    modes: Object.fromEntries(MODES.map((mode) => [mode, readMode(coreRoot, mode)])),
    roleRules: roleRules(rules),
    roles,
    rules,
    utilities: Object.fromEntries(
      UTILITIES.map((name) => [name, utilitySection(rules, UTILITY_SECTIONS[name])]),
    ),
  };
};

const addOutput = (plan: Map<string, string>, relative: string, content: string): void => {
  if (plan.has(relative)) {
    throw new Error(`Duplicate plugin output path: ${relative}`);
  }
  plan.set(relative, content);
};

interface Profile {
  codex: { description: string; sandboxMode?: string };
  description: string;
  name: string;
  readOnly: boolean;
}

const profileMetadata = (packageRoot: string): Record<string, Profile> => {
  const value: unknown = JSON.parse(readInput(packageRoot, 'generation/profiles.json'));
  if (!isRecord(value)) {
    throw new Error('Invalid profile registry');
  }
  const profiles: Record<string, Profile> = {};
  for (const role of ROLES) {
    const profile = value[role];
    if (
      !isRecord(profile) ||
      profile.name !== role ||
      typeof profile.description !== 'string' ||
      typeof profile.readOnly !== 'boolean' ||
      !isRecord(profile.codex) ||
      typeof profile.codex.description !== 'string' ||
      !['string', 'undefined'].includes(typeof profile.codex.sandboxMode)
    ) {
      throw new Error(`Invalid profile metadata: ${role}`);
    }
    profiles[role] = {
      codex: {
        description: profile.codex.description,
        ...(typeof profile.codex.sandboxMode === 'string'
          ? { sandboxMode: profile.codex.sandboxMode }
          : {}),
      },
      description: profile.description,
      name: role,
      readOnly: profile.readOnly,
    };
  }
  return profiles;
};

// One profile serves every Markdown host: each loader reads its own keys and ignores the rest
// (Claude and Kimi: disallowedTools, Cursor: readonly, Kimi: subagents).
// Entries keep the emitted YAML in reading order: identity first, then host controls.
const nativeMetadata = (profile: Profile): Record<string, unknown> => {
  const readOnly: [string, unknown][] = profile.readOnly
    ? [
        ['readonly', true],
        ['disallowedTools', ['Write', 'Edit']],
      ]
    : [];
  return Object.fromEntries<unknown>([
    ['name', profile.name],
    ['description', profile.description],
    ...readOnly,
    ['subagents', []],
  ]);
};

const codexProfile = (profile: Profile, instructions: string): string => {
  if (instructions.includes('"""')) {
    throw new Error(`Unsupported TOML instruction delimiter: ${profile.name}`);
  }
  const header = [
    `name = ${JSON.stringify(`maestria-${profile.name}`)}`,
    `description = ${JSON.stringify(profile.codex.description)}`,
    ...(profile.codex.sandboxMode === undefined
      ? []
      : [`sandbox_mode = ${JSON.stringify(profile.codex.sandboxMode)}`]),
  ];
  return `${header.join('\n')}\n\n${TOML_NOTICE}\ndeveloper_instructions = """\n${instructions.replaceAll('\\', '\\\\')}\n"""\n`;
};

const addProfiles = (plan: Map<string, string>, packageRoot: string, input: Inputs): void => {
  const profiles = profileMetadata(packageRoot);
  for (const role of ROLES) {
    const body = compose(input.roles[role], input.roleRules[role]);
    addOutput(plan, `agents/${role}.md`, document(body, nativeMetadata(profiles[role])));
    addOutput(
      plan,
      `agents/maestria-${role}.toml`,
      codexProfile(profiles[role], compose(body, input.contexts.codex)),
    );
  }
};

const addPolicyRules = (plan: Map<string, string>, input: Inputs, routerPolicy: string): void => {
  addOutput(
    plan,
    'rules/global.md',
    // OMP applies this root rule; Devin also discovers flat rules/*.md, and `trigger: manual`
    // keeps it from loading this OMP copy next to its own always-on AGENTS.md.
    document(compose(routerPolicy, input.contexts.omp), {
      alwaysApply: true,
      description: 'maestria global policy and main-session workflow routing',
      trigger: 'manual',
    }),
  );
  addOutput(
    plan,
    'rules/cursor/maestria-global.mdc',
    document(compose(routerPolicy, input.contexts.cursor), {
      alwaysApply: true,
      description: 'maestria global policy and Cursor workflow routing',
    }),
  );
};

// One root AGENTS.md serves every host that reads a plain session context: Devin loads it
// always-on, Kimi Code through `systemPromptPath`, the CLI installs it into Codex's AGENTS.md,
// and Hermes users add it manually. Each host note sits under its own heading.
const SESSION_HOSTS = ['devin', 'kimi-code', 'codex', 'hermes'];
const HOST_NOTES_INTRO =
  '## Host Notes\n\nEach section below applies only on the host it names; skip the others.';
const demote = (markdown: string): string =>
  markdown.replaceAll(/^(?<hashes>#{2,5}) /gmu, '#$<hashes> ');

const addSessionContext = (plan: Map<string, string>, input: Inputs, complete: string): void => {
  const notes = SESSION_HOSTS.map((host) => demote(input.contexts[host]));
  const context = document(compose(complete, HOST_NOTES_INTRO, ...notes));
  if (Buffer.byteLength(context) > 32 * 1024) {
    throw new Error("AGENTS.md exceeds Kimi Code's documented 32 KB system prompt limit");
  }
  addOutput(plan, 'AGENTS.md', context);
};

const addModeCommands = (plan: Map<string, string>, input: Inputs, routerPolicy: string): void => {
  for (const mode of MODES) {
    const { body, metadata } = input.modes[mode];
    const command = compose(body, routerPolicy, input.arguments);
    addOutput(
      plan,
      `commands/${mode}.md`,
      // Hosts name commands by filename; ZCode warns on an unknown `name` key.
      document(command, { description: metadata.description }),
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
      document(source, {
        description: utilityDescription(utility),
        name: utility,
      }),
    );
  }
};

const addContexts = (plan: Map<string, string>, input: Inputs): void => {
  const routerPolicy = compose(input.roles.orchestrator, input.rules);
  const complete = compose(routerPolicy, ...MODES.map((mode) => input.modes[mode].body));
  addPolicyRules(plan, input, routerPolicy);
  addSessionContext(plan, input, complete);
  addModeCommands(plan, input, routerPolicy);
  addUtilitySkills(plan, input);
};

const validateManifestResources = (packageRoot: string, plan: Map<string, string>): void => {
  for (const output of ROOT_MANIFESTS) {
    const manifest: unknown = JSON.parse(readInput(packageRoot, output));
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
        // Every selected resource must be a generated output, so a stale file left on disk
        // cannot satisfy a manifest after the generator stops producing it.
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
  addProfiles(plan, packageRoot, input);
  addContexts(plan, input);
  validateManifestResources(packageRoot, plan);
  return plan;
};

const validateOutputPaths = (repoRoot: string, plan: Map<string, string>): void => {
  const packageRoot = path.resolve(repoRoot, 'packages/agent-plugins');
  for (const relative of plan.keys()) {
    const absolute = assertContainedFile(packageRoot, relative);
    if (fs.existsSync(absolute) && !fs.statSync(absolute).isFile()) {
      throw new Error(`Plugin resource is not a file: ${relative}`);
    }
  }
};

/** A file is ours only when it carries the generator's notice line; others are never touched. */
const isGenerated = (absolute: string): boolean => {
  const notice = absolute.endsWith('.toml') ? TOML_NOTICE : GENERATED_NOTICE;
  return normalizeLineEndings(fs.readFileSync(absolute, 'utf-8')).split('\n').includes(notice);
};

/** Generated files the current plan no longer produces, found by notice instead of a path list. */
const staleOutputs = (packageRoot: string, plan: Map<string, string>): string[] => {
  const stale: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(packageRoot, absolute).split(path.sep).join('/');
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        visit(absolute);
      } else if (
        entry.isFile() &&
        /\.(?:md|mdc|toml)$/u.test(entry.name) &&
        !plan.has(relative) &&
        isGenerated(absolute)
      ) {
        stale.push(relative);
      }
    }
  };
  visit(packageRoot);
  return stale;
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
  const stale = staleOutputs(packageRoot, plan);
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
