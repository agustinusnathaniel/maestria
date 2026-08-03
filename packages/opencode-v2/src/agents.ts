import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { AGENTS_DIR } from '@/root.js';

export interface AgentInfo {
  description: string;
  mode: string;
  prompt: string; // the markdown body - this maps to Agent.Info.system
  steps?: number;
  color?: string;
}

function parseFrontmatter(yamlStr: string): Omit<AgentInfo, 'prompt'> {
  const result = parseYaml(yamlStr) as Record<string, unknown>;
  return {
    description: (result.description as string) || '',
    mode: (result.mode as string) || 'subagent',
    steps: result.steps ? Number(result.steps) : undefined,
    color: result.color as string | undefined,
  };
}

function parseAgentFile(filePath: string): { name: string; config: AgentInfo } {
  const content = readFileSync(filePath, 'utf-8');
  const name = basename(filePath, '.md');

  const parts = content.split('---');
  if (parts.length < 3) {
    throw new Error(`Invalid agent file: ${filePath} - missing frontmatter`);
  }

  const frontmatter = parseFrontmatter(parts[1].trim());
  const prompt = parts.slice(2).join('---').trim();

  return {
    name,
    config: { ...frontmatter, prompt },
  };
}

export function loadAgents(): Record<string, AgentInfo> {
  try {
    const files = readdirSync(AGENTS_DIR).filter(
      (f) => f.endsWith('.md') && f !== 'orchestrator.md',
    );
    const agents: Record<string, AgentInfo> = {};

    for (const file of files) {
      try {
        const { name, config } = parseAgentFile(join(AGENTS_DIR, file));
        agents[name] = config;
      } catch (err) {
        console.warn(`[maestria-v2] Failed to parse agent file "${file}":`, err);
      }
    }

    return agents;
  } catch (err) {
    console.error('[maestria-v2] Failed to read agents directory:', err);
    return {};
  }
}

export function loadOrchestrator(): (AgentInfo & { name: string }) | null {
  try {
    const { name, config } = parseAgentFile(join(AGENTS_DIR, 'orchestrator.md'));
    return { ...config, name };
  } catch (err) {
    console.warn('[maestria-v2] Failed to load orchestrator agent:', err);
    return null;
  }
}
