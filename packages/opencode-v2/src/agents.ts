import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Schema } from 'effect';
import { Agent } from '@opencode/plugin/effect';
import { splitMarkdown } from '@/markdown.js';
import { AGENTS_DIR } from '@/root.js';

export interface AgentInfo {
  description: string;
  mode: string;
  permissions: Agent.Info['permissions'][number][];
  prompt: string;
  steps?: number;
  color?: string;
}

export const isAgentMode = Schema.is(Agent.Info.fields.mode);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseFrontmatter = (yamlStr: string): Omit<AgentInfo, 'prompt'> => {
  const parsed = parseYaml(yamlStr) as unknown;
  const result = isRecord(parsed) ? parsed : {};
  return {
    color: typeof result.color === 'string' ? result.color : undefined,
    description: typeof result.description === 'string' ? result.description : '',
    mode: typeof result.mode === 'string' && result.mode !== '' ? result.mode : 'subagent',
    permissions:
      result.permissions === undefined
        ? []
        : [...Schema.decodeUnknownSync(Agent.Info.fields.permissions)(result.permissions)],
    steps:
      result.steps !== undefined && result.steps !== null && result.steps !== ''
        ? Number(result.steps)
        : undefined,
  };
};

const parseAgentFile = (filePath: string): AgentInfo => {
  const { body, frontmatter } = splitMarkdown(readFileSync(filePath, 'utf-8'));
  if (frontmatter === undefined) {
    throw new Error(`Invalid agent file: ${filePath} - missing frontmatter`);
  }
  return { ...parseFrontmatter(frontmatter), prompt: body.trim() };
};

export const loadAgents = (): Record<string, AgentInfo> => {
  try {
    const files = readdirSync(AGENTS_DIR).filter(
      (f) => f.endsWith('.md') && f !== 'orchestrator.md',
    );
    const agents: Record<string, AgentInfo> = {};

    for (const file of ['orchestrator.md', ...files]) {
      try {
        agents[path.basename(file, '.md')] = parseAgentFile(path.join(AGENTS_DIR, file));
      } catch (error) {
        console.warn(`[maestria-v2] Failed to parse agent file "${file}":`, error);
      }
    }

    return agents;
  } catch (error) {
    throw new Error('[maestria-v2] Failed to read agents directory', { cause: error });
  }
};
