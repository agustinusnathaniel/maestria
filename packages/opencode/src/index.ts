import type { Config, Hooks, Plugin, PluginInput } from '@opencode-ai/plugin';
import { merge } from 'es-toolkit';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { detectMode, getModeMarker, getModePrompt, stripKeyword } from '@/modes/index.js';
import { maestriaOptionsSchema } from '@/modes/types.js';
import type { MaestriaPluginOptions } from '@/modes/types.js';
import { AGENTS_DIR, RULES_PATH } from '@/root.js';

type OpenCodeAgentConfig = NonNullable<NonNullable<Config['agent']>[string]>;
type AgentMode = NonNullable<OpenCodeAgentConfig['mode']>;
type AgentPermission = NonNullable<OpenCodeAgentConfig['permission']> & Record<string, unknown>;
type AgentConfig = Omit<OpenCodeAgentConfig, 'mode' | 'permission'> & {
  mode: AgentMode;
  permission: AgentPermission;
};
type ChatMessageHook = NonNullable<Hooks['chat.message']>;
type ChatMessageInput = Parameters<ChatMessageHook>[0];
type ChatMessageOutput = Parameters<ChatMessageHook>[1];
type TextPart = Extract<ChatMessageOutput['parts'][number], { type: 'text' }>;
type ConfigInput = Parameters<NonNullable<Hooks['config']>>[0];
type CompactingOutput = Parameters<NonNullable<Hooks['experimental.session.compacting']>>[1];

interface AgentFrontmatter {
  description: string;
  mode: AgentMode;
  permission: AgentPermission;
  color?: string;
  maxSteps?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAgentMode = (value: unknown): value is AgentMode =>
  value === 'all' || value === 'primary' || value === 'subagent';

const parsePermission = (value: unknown): AgentPermission => {
  if (!isRecord(value)) {
    return {};
  }

  const permission: AgentPermission = {};
  for (const [key, permissionValue] of Object.entries(value)) {
    permission[key] = permissionValue;
  }
  return permission;
};

const parseFrontmatter = (yamlStr: string): AgentFrontmatter => {
  const parsed = parseYaml(yamlStr) as unknown;
  const result = isRecord(parsed) ? parsed : {};

  return {
    color: typeof result.color === 'string' ? result.color : undefined,
    description: typeof result.description === 'string' ? result.description : '',
    maxSteps:
      result.maxSteps !== undefined && result.maxSteps !== null && result.maxSteps !== ''
        ? Number(result.maxSteps)
        : undefined,
    mode: isAgentMode(result.mode) ? result.mode : 'subagent',
    permission: parsePermission(result.permission),
  };
};

/**
 * Read an agent markdown file and split into frontmatter + prompt.
 */
const parseAgentFile = (filePath: string): { name: string; config: AgentConfig } => {
  const content = readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath, '.md');

  const parts = content.split('---');
  if (parts.length < 3) {
    throw new Error(`Invalid agent file: ${filePath} - missing frontmatter`);
  }

  const frontmatter = parseFrontmatter(parts[1].trim());
  const prompt = parts.slice(2).join('---').trim();

  const config: AgentConfig = {
    description: frontmatter.description,
    mode: frontmatter.mode,
    permission: frontmatter.permission,
    prompt,
  };

  if (frontmatter.color !== undefined && frontmatter.color !== null && frontmatter.color !== '') {
    config.color = frontmatter.color;
  }
  if (
    frontmatter.maxSteps !== undefined &&
    frontmatter.maxSteps !== null &&
    frontmatter.maxSteps !== 0
  ) {
    config.maxSteps = frontmatter.maxSteps;
  }

  return { config, name };
};

/**
 * Load all agent configs from the bundled agents/ directory.
 * Returns partial results if some agent files fail to load.
 */
const loadAgents = (): NonNullable<Config['agent']> => {
  try {
    const files = readdirSync(AGENTS_DIR).filter((file) => file.endsWith('.md'));
    const agents: NonNullable<Config['agent']> = {};

    for (const file of files) {
      try {
        const { name, config } = parseAgentFile(path.join(AGENTS_DIR, file));
        agents[name] = config;
      } catch (error) {
        console.warn(`[maestria] Failed to parse agent file "${file}":`, error);
      }
    }

    return agents;
  } catch (error) {
    console.error('[maestria] Failed to read agents directory:', error);
    throw new Error(
      `[maestria] Failed to load agents from "${AGENTS_DIR}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
};

const applyModeToMessage = (
  hookInput: ChatMessageInput,
  hookOutput: ChatMessageOutput,
  disabledKeywords: Set<string>,
): void => {
  if (hookInput.agent !== 'orchestrator') {
    return;
  }

  const textPart = hookOutput.parts.find((part): part is TextPart => part.type === 'text');
  if (textPart === undefined) {
    return;
  }

  const result = detectMode(textPart.text, disabledKeywords);
  if (result === null) {
    return;
  }

  textPart.text = [
    getModeMarker(result.mode),
    '',
    getModePrompt(result.mode),
    '',
    stripKeyword(textPart.text, result),
  ].join('\n');
};

const configureAgents = (input: ConfigInput, agents: NonNullable<Config['agent']>): void => {
  input.agent = merge(input.agent ?? {}, agents);
  input.instructions = [...(input.instructions ?? []), RULES_PATH];
};

const appendCompactionContext = (output: CompactingOutput): void => {
  output.context.push(
    'Session was compacted. Task tracking is maintained via todowrite. ' +
      'Active context (files, decisions, blockers) was captured before compaction. ' +
      'Continue where you left off.',
  );
};

export const MaestriaPlugin: Plugin = async (
  _input: PluginInput,
  options?: MaestriaPluginOptions,
) => {
  const parsed = maestriaOptionsSchema.parse(options ?? {});
  const disabledKeywords = new Set<string>(
    (parsed.modes?.disabledKeywords ?? []).map((keyword) => keyword.toLowerCase()),
  );
  const agents = loadAgents();
  await Promise.resolve();

  return {
    'chat.message': async (hookInput, hookOutput) => {
      applyModeToMessage(hookInput, hookOutput, disabledKeywords);
      await Promise.resolve();
    },
    config: async (input) => {
      configureAgents(input, agents);
      await Promise.resolve();
    },
    'experimental.session.compacting': async (_compactingInput, output) => {
      appendCompactionContext(output);
      await Promise.resolve();
    },
  };
};

export default MaestriaPlugin;
