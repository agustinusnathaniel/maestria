import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Context, Service } from '@deepseek-ai/cordis';
import { renderPrompt, SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools';
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { parse } from 'yaml';

import * as maestria from '../src/index.js';
import * as reviewer from '../src/reviewer.js';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nested = (row: Row): unknown[] => [
  row.insert,
  row.config,
  isRow(row.config) ? row.config.plugins : undefined,
];
/** Every row in a list: inserts, each preset's plugins, and group children. */
const rowsIn = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter(isRow).flatMap((row) => [row, ...nested(row).flatMap(rowsIn)])
    : [];

// `!!js` scalars are Loader expressions; keep them as text.
const patchText = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf-8');
const patchRows = rowsIn(
  parse(patchText, {
    customTags: [{ resolve: (source: string) => source, tag: 'tag:yaml.org,2002:js' }],
  }),
);
const presetPlugins = (id: string): Row[] => {
  const config = patchRows.find((row) => isRow(row.config) && row.config.id === id)?.config;
  return isRow(config) ? rowsIn(config.plugins) : [];
};

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8', stdio: 'pipe' });

const project = (current: PromptAssembly): string | undefined =>
  current.contexts.find((context) => context.name === 'maestria:project')?.text;

let repo: string;
let ctx: Context;
let assembly: PromptAssembly;
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the plugin reads only the agent's session.
const agent = { session: {} } as unknown as Agent;
// oxlint-disable-next-line require-await -- the waterfall's innermost default must return a promise.
const allow = async (): Promise<PreToolDecision> => ({ kind: 'allow' });

const decide = async (name: string, args: unknown): Promise<PreToolDecision> =>
  await ctx.waterfall(
    'tools/pre-execute',
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the guard reads only agent, name, and arguments.
    { agent, arguments: args, name } as unknown as ToolExecution,
    allow,
  );

beforeAll(async () => {
  repo = mkdtempSync(path.join(tmpdir(), 'maestria-dsh-'));
  git(repo, 'init', '-q', '-b', 'main');
  mkdirSync(path.join(repo, '.maestria'));
  writeFileSync(path.join(repo, '.maestria/rules.md'), 'Run pnpm check before pushing.\n');
  writeFileSync(path.join(repo, 'gen.md'), '<!-- Auto-generated. Do not edit directly. -->\n');
  mkdirSync(path.join(repo, 'src'));

  class WorkingDirectory extends Service {
    readonly directory = path.join(repo, 'src');
    constructor(parent: Context) {
      super(parent, 'workingDirectory');
    }
    get(): string {
      return this.directory;
    }
  }

  ctx = new Context();
  await ctx.plugin(SystemPrompt, {});
  await ctx.plugin(WorkingDirectory);
  await ctx.plugin(maestria);
  await ctx.plugin(reviewer);
  assembly = await ctx.systemPrompt.assemble({ agent });
});

afterAll(() => {
  rmSync(repo, { force: true, recursive: true });
});

describe('maestria presets on the real DeepSeek Harness system prompt', () => {
  it('renders the persona variables each preset references from generated prompts', () => {
    const references = [...patchText.matchAll(/\{\{(?<name>maestria_\w+)\}\}/gu)].map(
      (match) => match.groups?.name,
    );
    expect(new Set(references)).toEqual(new Set(['maestria_main_loop', 'maestria_reviewer']));
    const rendered = renderPrompt({
      ...assembly,
      sections: [{ name: 'test', text: '{{maestria_main_loop}}\n{{maestria_reviewer}}' }],
    });
    expect(rendered).toContain('You are the main loop');
    expect(rendered).toContain('## DeepSeek Harness Integration');
    expect(rendered).toContain('You review code as a read-only checker.');
    expect(rendered).not.toContain('Auto-generated');
  });

  it('adds the main-session rules and the reviewer rules as literal sections', () => {
    const rendered = renderPrompt(assembly);
    expect(rendered).toContain('# Main Session');
    expect(rendered).toContain('# Acceptance and Blind Review');
    for (const name of ['maestria:rules', 'maestria:reviewer-rules']) {
      expect(assembly.sections.find((section) => section.name === name)?.interpolate).toBe(false);
    }
  });

  it('reads .maestria files from the git root of the session directory every assembly', async () => {
    expect(project(assembly)).toContain('Run pnpm check before pushing.');
    writeFileSync(path.join(repo, '.maestria/workflow.md'), 'Plan first.\n');
    const next = project(await ctx.systemPrompt.assemble({ agent }));
    expect(next?.indexOf('Plan first.')).toBeLessThan(next?.indexOf('Run pnpm') ?? -1);
  });
});

describe('maestria guard on tools/pre-execute', () => {
  it('denies hook bypasses and asks before commits to a protected branch', async () => {
    await expect(decide('bash', { command: 'git commit --no-verify -m x' })).resolves.toMatchObject(
      { kind: 'deny' },
    );
    await expect(decide('bash', { command: 'git commit -m x' })).resolves.toMatchObject({
      kind: 'ask',
      reason: expect.stringContaining('main') as unknown,
    });
    await expect(decide('bash', { command: 'git status' })).resolves.toEqual({ kind: 'allow' });
  });

  it('asks before editing a generated file and lets other tools through', async () => {
    await expect(decide('edit', { file_path: '../gen.md' })).resolves.toMatchObject({
      kind: 'ask',
    });
    await expect(decide('write', { file_path: '../new.md' })).resolves.toEqual({ kind: 'allow' });
    await expect(decide('read', { file_path: '../gen.md' })).resolves.toEqual({ kind: 'allow' });
  });
});

describe('maestria preset composition', () => {
  it('starts the reviewer on its own preset with only read, search, and skill tools', () => {
    expect(presetPlugins('maestria').find((row) => row.id === 'maestria-reviewer')).toMatchObject({
      config: { agentPreset: 'maestria-reviewer', toolName: 'maestria_reviewer' },
    });
    const tools = presetPlugins('maestria-reviewer').filter((row) =>
      String(row.name).includes('dsh-tool-'),
    );
    expect(tools.map((row) => row.name)).toEqual([
      '@deepseek-ai/dsh-tool-fs',
      '@deepseek-ai/dsh-tool-fs-search',
      '@deepseek-ai/dsh-tool-skill',
    ]);
    expect(tools[0]?.config).toMatchObject({ edit: false, write: false });
  });

  it('ships every skill under the pruner threshold the preset restates', () => {
    const pruner = presetPlugins('maestria').find((row) => row.id === 'tool-result-pruner');
    const threshold = isRow(pruner?.config) ? Number(pruner.config.thresholdChars) : 0;
    const skills = new URL('../skills/', import.meta.url);
    for (const name of readdirSync(skills)) {
      const text = readFileSync(new URL(`${name}/SKILL.md`, skills), 'utf-8');
      expect(text.length, name).toBeLessThanOrEqual(threshold);
    }
  });
});
