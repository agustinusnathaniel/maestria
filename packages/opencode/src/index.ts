import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync, readdirSync, existsSync, mkdirSync, cpSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

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

/**
 * Parse a simple YAML frontmatter block. Handles:
 * - string values ("allow", "ask", "deny")
 * - nested objects (bash: { "*": "ask" })
 * - multiline strings (description)
 */
function parseFrontmatter(yaml: string): AgentFrontmatter {
  const lines = yaml.split("\n");
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];
  let nestedStack: { key: string; obj: Record<string, unknown>; indent: number }[] = [];

  function flushValue() {
    if (currentKey === null) return;
    const value = currentValue.join(" ").trim();
    if (value) {
      if (nestedStack.length > 0) {
        nestedStack[nestedStack.length - 1].obj[currentKey] = value;
      } else {
        result[currentKey] = value;
      }
    }
    currentKey = null;
    currentValue = [];
  }

  function getIndent(line: string): number {
    let count = 0;
    for (const ch of line) {
      if (ch === " " || ch === "\t") count++;
      else break;
    }
    return count;
  }

  function parseKeyValue(line: string): { key: string; value: string } | null {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return null;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    return { key, value };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const indent = getIndent(line);
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const kv = parseKeyValue(line);

    // Pop nested stacks that have ended
    while (nestedStack.length > 0 && indent <= nestedStack[nestedStack.length - 1].indent) {
      flushValue();
      nestedStack.pop();
    }

    if (kv) {
      flushValue();
      currentKey = kv.key;

      if (kv.value) {
        // Inline value: key: value
        if (nestedStack.length > 0) {
          nestedStack[nestedStack.length - 1].obj[currentKey] = kv.value;
        } else {
          result[currentKey] = kv.value;
        }
        currentKey = null;
      } else {
        // Potential nested object: key:
        // Check next line for indentation
        const nextLine = lines[i + 1];
        if (nextLine && getIndent(nextLine) > indent) {
          const nestedObj: Record<string, unknown> = {};
          if (nestedStack.length > 0) {
            nestedStack[nestedStack.length - 1].obj[currentKey] = nestedObj;
          } else {
            result[currentKey] = nestedObj;
          }
          nestedStack.push({ key: currentKey, obj: nestedObj, indent });
          currentKey = null;
        }
        // Otherwise it's an empty value, ignore
      }
    } else {
      // Continuation line (for multiline strings like description)
      if (currentKey && indent > 0) {
        currentValue.push(trimmed);
      }
    }
  }

  flushValue();

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

const skillsSrc = join(__dirname, "..", "skills");
const configDir = join(homedir(), ".config", "opencode");
const skillsDest = join(configDir, "skills");

const SKILL_NAMES = ["web-ui-patterns", "mobile-setup-patterns", "infra-deployment-patterns"];

/**
 * Lazily sync bundled skills to OpenCode's skills directory on first load.
 * Copies individual skills that don't already exist in the target directory.
 * Unlike the previous check for the entire skills directory, this correctly
 * handles the case where the user has installed other skills (via CLI) but
 * is missing some skills bundled by this plugin.
 */
function syncSkillsToConfig(): void {
  try {
    mkdirSync(skillsDest, { recursive: true });
    for (const skillName of SKILL_NAMES) {
      const skillDest = join(skillsDest, skillName);
      if (!existsSync(skillDest)) {
        cpSync(join(skillsSrc, skillName), skillDest, { recursive: true });
      }
    }
  } catch {
    // Non-fatal: skills are optional — agents can still function
    // without them. Common failure: CI environments without a home
    // config directory.
  }
}

export const MaestriaPlugin: Plugin = async () => {
  syncSkillsToConfig();
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
  };
};

export default MaestriaPlugin;
