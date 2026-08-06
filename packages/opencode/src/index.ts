import type { Plugin } from '@opencode-ai/plugin';
import { merge } from 'es-toolkit';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { type MaestriaPluginOptions, maestriaOptionsSchema } from '@/modes/types.js';
import {
  detectMode,
  getModeMarker,
  getModePrompt,
  getRouteForMode,
  stripKeyword,
} from '@/modes/index.js';
import { assertToolAllowed } from '@/route-gate.js';
import { RouteRegistry } from '@/route-registry.js';
import { createMaestriaRouteTool } from '@/route-tool.js';
import { LANDING_REVIEW_TOOL } from '@/route-gate.js';
import { computeArtifactManifest, type ArtifactClient } from '@/landing-review.js';
import { isApprovedShippingCommandOnNonPrimaryBranch, isShippingCommand } from '@/shipping.js';
import { createMaestriaLandingReviewTool } from '@/landing-review-tool.js';
import { AGENTS_DIR, RULES_PATH } from '@/root.js';

interface AgentFrontmatter {
  description: string;
  mode: string;
  permission: Record<string, unknown>;
  color?: string;
  maxSteps?: number;
}

function parseFrontmatter(yamlStr: string): AgentFrontmatter {
  const result = parseYaml(yamlStr) as Record<string, unknown>;
  return {
    description: (result.description as string) || '',
    mode: (result.mode as string) || 'subagent',
    permission: (result.permission as Record<string, unknown>) || {},
    color: result.color as string | undefined,
    maxSteps: result.maxSteps ? Number(result.maxSteps) : undefined,
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
    prompt,
    permission: frontmatter.permission,
  };

  if (frontmatter.color) config.color = frontmatter.color;
  if (frontmatter.maxSteps) config.maxSteps = frontmatter.maxSteps;

  return { name, config };
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
      } catch (err) {
        console.warn(`[maestria] Failed to parse agent file "${file}":`, err);
      }
    }

    return agents;
  } catch (err) {
    console.error(`[maestria] Failed to read agents directory:`, err);
    throw new Error(
      `[maestria] Failed to load agents from "${AGENTS_DIR}": ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
}

export const MaestriaPlugin: Plugin = async (pluginInput, options?: MaestriaPluginOptions) => {
  // Validate and parse options with zod
  const parsed = maestriaOptionsSchema.parse(options ?? {});
  const disabledKeywords = new Set<string>(
    (parsed.modes?.disabledKeywords ?? []).map((k) => k.toLowerCase()),
  );
  const agents = loadAgents();
  const routeRegistry = new RouteRegistry();

  return {
    tool: {
      maestria_route: createMaestriaRouteTool(routeRegistry),
      [LANDING_REVIEW_TOOL]: createMaestriaLandingReviewTool(routeRegistry, pluginInput.client),
    },
    config: async (input) => {
      // Deep-merge plugin agent defaults over the user's agent entries. A
      // shallow `{ ...input.agent, ...agents }` would replace each entry
      // wholesale, dropping user-set keys (model, variant, temperature) for
      // the 8 maestria agent names. Plugin defaults win on conflict; user
      // keys the plugin does not set survive.
      input.agent = merge(input.agent ?? {}, agents);
      const orchestrator = input.agent?.orchestrator;
      if (orchestrator && typeof orchestrator === 'object') {
        const agentConfig = orchestrator as Record<string, unknown>;
        const permission = agentConfig.permission;
        agentConfig.permission = {
          ...(permission && typeof permission === 'object'
            ? (permission as Record<string, unknown>)
            : {}),
          [LANDING_REVIEW_TOOL]: 'allow',
        };
      }
      input.instructions = [...(input.instructions ?? []), RULES_PATH];
    },
    'experimental.session.compacting': async (_input, output) => {
      output.context.push(
        'Session was compacted. Task tracking is maintained via todowrite. ' +
          'Active context (files, decisions, blockers) was captured before compaction. ' +
          'Continue where you left off.',
      );
    },
    event: async ({ event }) => {
      if (event.type === 'session.idle') {
        routeRegistry.clear(event.properties.sessionID);
      } else if (event.type === 'session.deleted') {
        routeRegistry.clear(event.properties.info.id);
      } else if (event.type === 'session.status' && event.properties.status.type === 'idle') {
        routeRegistry.clear(event.properties.sessionID);
      }
    },
    'tool.execute.before': async (input, output) => {
      if (!routeRegistry.isRootSession(input.sessionID)) {
        if (isShippingCommand((output.args as Record<string, unknown> | undefined)?.command)) {
          throw new Error('[maestria] Only the root orchestrator session may ship an artifact.');
        }
        return;
      }

      // A root session always has a route entry. A null route is intentional:
      // it is the fail-closed state before maestria_route is called.
      const route = routeRegistry.get(input.sessionID) ?? null;
      const landingReview = routeRegistry.getLandingReview(input.sessionID);
      assertToolAllowed(route, input.tool, output.args, landingReview?.state ?? 'inactive');

      if (
        route === 'landing-review' &&
        landingReview?.state === 'approved' &&
        input.tool === 'bash'
      ) {
        const shippingBranchIsSafe = await isApprovedShippingCommandOnNonPrimaryBranch(
          output.args?.command,
          async () => {
            if (typeof pluginInput.$ !== 'function') return undefined;
            const branch = await pluginInput.$`git branch --show-current`
              .cwd(pluginInput.worktree ?? pluginInput.directory)
              .text();
            return branch.trim() || undefined;
          },
        );
        if (!shippingBranchIsSafe) {
          throw new Error(
            '[maestria] Approved shipping requires a host-verified non-primary current branch.',
          );
        }
        try {
          const currentManifest = await computeArtifactManifest(
            pluginInput.client as unknown as ArtifactClient,
            input.sessionID,
            pluginInput.directory,
          );
          if (
            routeRegistry.invalidateLandingReviewIfChanged(
              input.sessionID,
              currentManifest.digest,
              currentManifest,
            )
          ) {
            throw new Error('[maestria] Approved landing review is stale; the artifact changed.');
          }
        } catch (error) {
          routeRegistry.failLandingReview(input.sessionID);
          throw error;
        }
      }
    },
    'tool.execute.after': async (hookInput) => {
      if (hookInput.tool !== 'bash' || !routeRegistry.isRootSession(hookInput.sessionID)) return;
      const landingReview = routeRegistry.getLandingReview(hookInput.sessionID);
      if (landingReview?.state !== 'approved') return;

      try {
        const currentManifest = await computeArtifactManifest(
          pluginInput.client as unknown as ArtifactClient,
          hookInput.sessionID,
          pluginInput.directory,
        );
        routeRegistry.invalidateLandingReviewIfChanged(
          hookInput.sessionID,
          currentManifest.digest,
          currentManifest,
        );
      } catch {
        routeRegistry.failLandingReview(hookInput.sessionID);
      }
    },
    'chat.message': async (hookInput, hookOutput) => {
      // Only fire for the orchestrator agent
      if (hookInput.agent !== 'orchestrator') {
        // Do not leave root enforcement attached if a session is reused by a
        // different agent.
        routeRegistry.clear(hookInput.sessionID);
        return;
      }

      // Every user turn starts unselected. Explicit mode keywords below may
      // select a route before the model begins tool execution.
      routeRegistry.beginTurn(hookInput.sessionID);

      // Find the first text part with user content
      const textPart = hookOutput.parts.find((p) => p.type === 'text') as
        | { text: string; type: 'text' }
        | undefined;
      if (!textPart) return;

      // Detect keyword in the text
      const result = detectMode(textPart.text, disabledKeywords);
      if (!result) return;

      routeRegistry.select(hookInput.sessionID, getRouteForMode(result.mode));

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
  };
};

export default MaestriaPlugin;
