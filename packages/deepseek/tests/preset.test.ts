import { readFileSync } from 'node:fs';

import { Context } from '@deepseek-ai/cordis';
import { renderPrompt, SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt';
import { beforeAll, describe, expect, it } from 'vite-plus/test';
import { parse } from 'yaml';

import * as maestria from '../src/index.js';

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nested = (row: Row): unknown[] => [
  row.insert,
  row.config,
  isRow(row.config) ? row.config.plugins : undefined,
];
/** Every row in the patch: inserts, the preset's plugins, and group children. */
const rowsIn = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter(isRow).flatMap((row) => [row, ...nested(row).flatMap(rowsIn)])
    : [];

// `!!js` scalars are Loader expressions; keep them as text.
const patchText = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf-8');
const presetRows = rowsIn(
  parse(patchText, {
    customTags: [{ resolve: (source: string) => source, tag: 'tag:yaml.org,2002:js' }],
  }),
);
const READ_ONLY = { allow: ['read', 'glob', 'grep', 'skill'] };
const NO_EDIT = { deny: ['edit', 'write'] };
const TOOL_FILTERS: Record<string, unknown> = {
  adventurer: READ_ONLY,
  architect: NO_EDIT,
  diagnose: NO_EDIT,
  planner: READ_ONLY,
  reviewer: READ_ONLY,
};
const specialists = maestria.PERSONAS.filter((persona) => persona !== 'orchestrator');

let assembly: PromptAssembly;

beforeAll(async () => {
  const ctx = new Context();
  await ctx.plugin(SystemPrompt, {});
  await ctx.plugin(maestria);
  assembly = await ctx.systemPrompt.assemble();
});

describe('maestria preset on the real DeepSeek Harness system prompt', () => {
  it('renders every persona variable the preset references from its generated prompt', () => {
    const references = [...patchText.matchAll(/\{\{(?<name>maestria_\w+)\}\}/gu)].map(
      (match) => match.groups?.name,
    );
    expect(new Set(references)).toEqual(new Set(maestria.PERSONAS.map((p) => `maestria_${p}`)));
    const rendered = renderPrompt({
      ...assembly,
      sections: [{ name: 'test', text: references.map((name) => `{{${name}}}`).join('\n') }],
    });
    expect(rendered).toContain('You are the orchestrator');
    expect(rendered).toContain('## DeepSeek Harness Integration');
    expect(rendered).not.toContain('Auto-generated');
  });

  it('adds the global rules as a literal prompt section', () => {
    const rules = assembly.sections.find((section) => section.name === 'maestria:global-rules');
    expect(rules?.interpolate).toBe(false);
    expect(renderPrompt(assembly)).toContain('## Universal Floors');
  });

  it('delegates each specialist as a leaf with its role boundary enforced by the host', () => {
    for (const role of specialists) {
      const config = presetRows.find((row) => row.id === `maestria-${role}`)?.config;
      expect(config).toMatchObject({
        maxDepth: 1,
        persona: `{{maestria_${role}}}`,
        provider: 'spawn',
        toolName: `maestria_${role}`,
      });
      expect(isRow(config) ? config.toolFilter : undefined).toEqual(TOOL_FILTERS[role]);
    }
  });
});
