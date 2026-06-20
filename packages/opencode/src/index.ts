import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { parse as parseYaml } from "yaml";
import { fileURLToPath } from "url";
import { type MaestriaPluginOptions, maestriaOptionsSchema } from "./modes/types";
import { detectMode, stripKeyword, getModeMarker, getModePrompt } from "./modes/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, "..", "agents");
const rulesPath = join(__dirname, "..", "rules", "AGENTS.md");

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
    description: (result.description as string) || "",
    mode: (result.mode as string) || "subagent",
    permission: (result.permission as Record<string, unknown>) || {},
    color: result.color as string | undefined,
    maxSteps: result.maxSteps ? Number(result.maxSteps) : undefined,
  };
}

/**
 * Read an agent markdown file and split into frontmatter + prompt.
 */
function parseAgentFile(filePath: string): { name: string; config: Record<string, unknown> } {
  const content = readFileSync(filePath, "utf-8");
  const name = basename(filePath, ".md");

  // Split on ---
  const parts = content.split("---");
  if (parts.length < 3) {
    throw new Error(`Invalid agent file: ${filePath} — missing frontmatter`);
  }

  const frontmatter = parseFrontmatter(parts[1].trim());
  const prompt = parts.slice(2).join("---").trim();

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
 */
function loadAgents(): Record<string, Record<string, unknown>> {
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  const agents: Record<string, Record<string, unknown>> = {};

  for (const file of files) {
    const { name, config } = parseAgentFile(join(agentsDir, file));
    agents[name] = config;
  }

  return agents;
}

export const MaestriaPlugin: Plugin = async (_input, options?: MaestriaPluginOptions) => {
  // Validate and parse options with zod
  const parsed = maestriaOptionsSchema.parse(options ?? {});
  const disabledKeywords = new Set<string>(
    (parsed.modes?.disabledKeywords ?? []).map((k) => k.toLowerCase()),
  );
  const agents = loadAgents();

  return {
    config: async (input) => {
      input.agent = {
        ...input.agent,
        ...agents,
      };
      input.instructions = [...(input.instructions ?? []), rulesPath];
    },
    "experimental.session.compacting": async (_input, output) => {
      output.context.push(
        "Session was compacted. Task tracking is maintained via todowrite. " +
          "Active context (files, decisions, blockers) was captured before compaction. " +
          "Continue where you left off.",
      );
    },
    "chat.message": async (hookInput, hookOutput) => {
      // Only fire for the orchestrator agent
      if (hookInput.agent !== "orchestrator") return;

      // Find the first text part with user content
      const textPart = hookOutput.parts.find((p) => p.type === "text") as
        | { text: string; type: "text" }
        | undefined;
      if (!textPart) return;

      // Detect keyword in the text
      const result = detectMode(textPart.text, disabledKeywords);
      if (!result) return;

      // Strip keyword from text
      textPart.text = stripKeyword(textPart.text, result);

      // Inject mode marker + prompt at the front of parts
      hookOutput.parts.unshift({
        id: crypto.randomUUID(),
        sessionID: hookInput.sessionID,
        messageID: hookOutput.message.id,
        type: "text",
        text: [getModeMarker(result.mode), "", getModePrompt(result.mode)].join("\n"),
        synthetic: true,
      });
    },
  };
};

export default MaestriaPlugin;
