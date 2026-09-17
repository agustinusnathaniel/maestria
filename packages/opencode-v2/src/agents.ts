import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { AGENTS_DIR } from '@/root.js';

export interface AgentInfo {
  description: string;
  mode: string;
  // the markdown body - this maps to Agent.Info.system
  prompt: string;
  steps?: number;
  color?: string;
}

export type AgentMode = 'all' | 'primary' | 'subagent';

export const isAgentMode = (value: unknown): value is AgentMode =>
  value === 'all' || value === 'primary' || value === 'subagent';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseFrontmatter = (yamlStr: string): Omit<AgentInfo, 'prompt'> => {
  const parsed = parseYaml(yamlStr) as unknown;
  const result = isRecord(parsed) ? parsed : {};
  return {
    color: typeof result.color === 'string' ? result.color : undefined,
    description: typeof result.description === 'string' ? result.description : '',
    mode: typeof result.mode === 'string' && result.mode !== '' ? result.mode : 'subagent',
    steps:
      result.steps !== undefined && result.steps !== null && result.steps !== ''
        ? Number(result.steps)
        : undefined,
  };
};

const parseAgentFile = (filePath: string): { name: string; config: AgentInfo } => {
  const content = readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath, '.md');

  const parts = content.split('---');
  if (parts.length < 3) {
    throw new Error(`Invalid agent file: ${filePath} - missing frontmatter`);
  }

  const frontmatter = parseFrontmatter(parts[1].trim());
  const prompt = parts.slice(2).join('---').trim();

  return {
    config: { ...frontmatter, prompt },
    name,
  };
};

export const loadAgents = (): Record<string, AgentInfo> => {
  try {
    const files = readdirSync(AGENTS_DIR).filter(
      (f) => f.endsWith('.md') && f !== 'orchestrator.md',
    );
    const agents: Record<string, AgentInfo> = {};

    for (const file of files) {
      try {
        const { name, config } = parseAgentFile(path.join(AGENTS_DIR, file));
        agents[name] = config;
      } catch (error) {
        console.warn(`[maestria-v2] Failed to parse agent file "${file}":`, error);
      }
    }

    return agents;
  } catch (error) {
    console.error('[maestria-v2] Failed to read agents directory:', error);
    return {};
  }
};

export const loadOrchestrator = (): (AgentInfo & { name: string }) | null => {
  try {
    const { name, config } = parseAgentFile(path.join(AGENTS_DIR, 'orchestrator.md'));
    return { ...config, name };
  } catch (error) {
    console.warn('[maestria-v2] Failed to load orchestrator agent:', error);
    return null;
  }
};
