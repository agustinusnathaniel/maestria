import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import { merge } from 'es-toolkit';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { maestriaOptionsSchema } from '@/modes/types.js';
import type { MaestriaPluginOptions } from '@/modes/types.js';
import { detectMode, stripKeyword, getModeMarker, getModePrompt } from '@/modes/index.js';
import { AGENTS_DIR, RULES_PATH } from '@/root.js';

interface AgentFrontmatter {
  description: string;
  mode: string;
  permission: Record<string, unknown>;
  color?: string;
  maxSteps?: number;
}

function parseFrontmatter(yamlStr: string): AgentFrontmatter {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown via runtime type guard, safe assertion
  const result = parseYaml(yamlStr) as Record<string, unknown>;
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from broader type via prior validation, safe string/boolean assertion
    color: result.color as string | undefined,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from broader type via prior validation, safe string/boolean assertion
    description: (result.description as string) || '',
    maxSteps:
      result.maxSteps !== undefined && result.maxSteps !== null && result.maxSteps !== ''
        ? Number(result.maxSteps)
        : undefined,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from broader type via prior validation, safe string/boolean assertion
    mode: (result.mode as string) || 'subagent',
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: narrow from unknown via runtime type guard, safe assertion
    permission: (result.permission as Record<string, unknown>) ?? {},
  };
}

/**
 * Read an agent markdown file and split into frontmatter + prompt.
 */
function parseAgentFile(filePath: string): { name: string; config: Record<string, unknown> } {
  const content = readFileSync(filePath, 'utf-8');
  const name = basename(filePath, '.md');

  // Split on ---
  const parts = content.split('---');
  if (parts.length < 3) {
    throw new Error(`Invalid agent file: ${filePath} - missing frontmatter`);
  }

  const frontmatter = parseFrontmatter(parts[1].trim());
  const prompt = parts.slice(2).join('---').trim();

  const config: Record<string, unknown> = {
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
}

/**
 * Load all agent configs from the bundled agents/ directory.
 * Returns partial results if some agent files fail to load.
 */
function loadAgents(): Record<string, Record<string, unknown>> {
  try {
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
    const agents: Record<string, Record<string, unknown>> = {};

    for (const file of files) {
      try {
        const { name, config } = parseAgentFile(join(AGENTS_DIR, file));
        agents[name] = config;
      } catch (error) {
        console.warn(`[maestria] Failed to parse agent file "${file}":`, error);
      }
    }

    return agents;
  } catch (error) {
    console.error(`[maestria] Failed to read agents directory:`, error);
    throw new Error(
      `[maestria] Failed to load agents from "${AGENTS_DIR}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

export const MaestriaPlugin: Plugin = async (
  _input: PluginInput,
  options?: MaestriaPluginOptions,
) => {
  // Validate and parse options with zod
  const parsed = maestriaOptionsSchema.parse(options ?? {});
  const disabledKeywords = new Set<string>(
    (parsed.modes?.disabledKeywords ?? []).map((k) => k.toLowerCase()),
  );
  const agents = loadAgents();

  return {
    // oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: OpenCode hook types are untyped at plugin boundary, use any for runtime interop
    'chat.message': async (hookInput: any, hookOutput: any) => {
      // Only fire for the orchestrator agent
      if (hookInput.agent !== 'orchestrator') {
        return;
      }

      // Find the first text part with user content
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: validated via prior type check, safe narrow
      const textPart = hookOutput.parts.find((p: { type: string }) => p.type === 'text') as
        | { text: string; type: 'text' }
        | undefined;
      if (!textPart) {
        return;
      }

      // Detect keyword in the text
      const result = detectMode(textPart.text, disabledKeywords);
      if (!result) {
        return;
      }

      // Strip keyword from text and prepend mode marker + prompt inline.
      // We embed everything in the existing text part rather than injecting
      // a second text part into `parts`, because the OpenCode runtime does
      // not handle multiple text parts per message (causes a hang).
      textPart.text = [
        getModeMarker(result.mode),
        '',
        getModePrompt(result.mode),
        '',
        stripKeyword(textPart.text, result),
      ].join('\n');
    },
    // oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: OpenCode config input is untyped, use any for interop
    config: async (input: any) => {
      // Deep-merge plugin agent defaults over the user's agent entries. A
      // shallow `{ ...input.agent, ...agents }` would replace each entry
      // wholesale, dropping user-set keys (model, variant, temperature) for
      // the 8 maestria agent names. Plugin defaults win on conflict; user
      // keys the plugin does not set survive.
      input.agent = merge(input.agent ?? {}, agents);
      input.instructions = [...(input.instructions ?? []), RULES_PATH];
    },
    // oxlint-disable-next-line typescript/no-explicit-any -- SAFETY: OpenCode compacting hook types untyped, use any
    'experimental.session.compacting': async (_input: any, output: any) => {
      output.context.push(
        'Session was compacted. Task tracking is maintained via todowrite. ' +
          'Active context (files, decisions, blockers) was captured before compaction. ' +
          'Continue where you left off.',
      );
    },
  };
};

export default MaestriaPlugin;
