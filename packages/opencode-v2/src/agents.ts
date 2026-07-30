import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { AGENTS_DIR } from '@/root.js';

interface AgentFrontmatter {
  description: string;
  mode: string;
  prompt: string;
  permission?: Record<string, unknown>;
  color?: string;
  maxSteps?: number;
}

function parseFrontmatter(yamlStr: string): Omit<AgentFrontmatter, 'prompt'> {
  const result = parseYaml(yamlStr) as Record<string, unknown>;
  return {
    description: (result.description as string) || '',
    mode: (result.mode as string) || 'subagent',
    permission: result.permission as Record<string, unknown> | undefined,
    color: result.color as string | undefined,
    maxSteps: result.maxSteps ? Number(result.maxSteps) : undefined,
  };
}

function parseAgentFile(filePath: string): { name: string; config: AgentFrontmatter } {
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

export function loadAgents(): Record<string, AgentFrontmatter> {
  try {
    const files = readdirSync(AGENTS_DIR).filter(
      (f) => f.endsWith('.md') && f !== 'orchestrator.md',
    );
    const agents: Record<string, AgentFrontmatter> = {};

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

export function loadOrchestrator(): AgentFrontmatter | null {
  try {
    const { config } = parseAgentFile(join(AGENTS_DIR, 'orchestrator.md'));
    return config;
  } catch (err) {
    console.warn('[maestria-v2] Failed to load orchestrator agent:', err);
    return null;
  }
}
