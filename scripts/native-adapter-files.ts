// Generated agent, command, rule, and skill files for the OpenCode and Pi runtime adapters.
import { opencodeAgents } from '../packages/opencode/generation/agents.js';
import {
  extractSection,
  serializeFrontmatter,
  stripFrontmatter,
} from '../packages/core/scripts/lib/transforms.js';

export const NATIVE_NOTICE =
  '<!-- Auto-generated from @maestria/core. Do not edit directly.\n     Edit the canonical file at packages/core/agent-directives/ instead. -->';

export interface NativeInputs {
  readonly modes: Record<string, { source: string }>;
  readonly roleSkills: Record<string, string>;
  readonly roles: Record<string, string>;
  readonly rules: string;
}

const generated = (body: string, frontmatter = ''): string => {
  const content = `${frontmatter}${frontmatter ? '\n' : ''}${NATIVE_NOTICE}\n\n${body}`;
  return content.endsWith('\n') ? content : `${content}\n`;
};

const section = (source: string, heading: string): string => {
  const extracted = extractSection(source, heading);
  if (extracted === null) {
    throw new Error(`Missing section "## ${heading}" in specialists/main-loop.md`);
  }
  return extracted;
};

const piFrontmatter = (...lines: string[]): string => `---\n${lines.join('\n')}\n---\n\n`;

const PI_FRONTMATTER = {
  'global-rules': piFrontmatter(
    'name: global-rules',
    'description: >-',
    '  Global behavioral constraints and best practices for maestria-powered',
    '  Pi agents. Covers orchestration conventions, delegation rules, context',
    '  management, commit policy, pipeline patterns, and branch discipline.',
  ),
  maestria: piFrontmatter(
    'name: maestria',
    'description: >-',
    '  maestria main loop. Investigates, designs, and implements with the recon,',
    '  architecture-plan, and diagnose skills, sends meaningful changes to one blind',
    '  reviewer subagent, and owns delivery. Enforces the maker/checker split and',
    '  commit protocol.',
  ),
  // Pi treats unregistered tool names as inert filter entries; roster.test.ts checks this list
  // against the installed host's registered tools.
  reviewer: piFrontmatter(
    'description: >-',
    '  Code review specialist. Reviews for correctness, edge cases, security,',
    '  performance, and maintainability in one general review. Adds specialist',
    '  lenses only for matching security, performance, architecture, or UX risk;',
    '  preserves blind review, lens exclusivity, and fix/dismiss/escalate triage.',
    'tools: read, grep, find, ls',
    'prompt_mode: append',
    'inherit_context: true',
  ),
};

const opencodeFiles = (input: NativeInputs): Map<string, string> => {
  const mainLoop = input.roles['main-loop'];
  const files = new Map<string, string>([
    ['agents/maestria.md', generated(mainLoop, serializeFrontmatter(opencodeAgents.maestria))],
    [
      'agents/reviewer.md',
      generated(
        `${input.roles.reviewer}\n\n${input.roleSkills.reviewer}`,
        serializeFrontmatter(opencodeAgents.reviewer),
      ),
    ],
    ['rules/AGENTS.md', generated(input.rules)],
    ['rules/delivery.md', generated(section(mainLoop, 'Continuation and Delivery'))],
    ['rules/modes.md', generated(section(mainLoop, 'Modes'))],
  ]);
  for (const [mode, { source }] of Object.entries(input.modes)) {
    files.set(`agents/commands/${mode}.md`, generated(source));
  }
  return files;
};

// Pi invokes subagents as `/name`, so canonical `@name` mentions are rewritten.
const piFiles = (input: NativeInputs, roles: readonly string[]): Map<string, string> => {
  const pi = (source: string): string => {
    let text = stripFrontmatter(source);
    for (const role of roles) {
      text = text.replaceAll(`@${role}`, `/${role}`);
    }
    return text;
  };
  const files = new Map<string, string>([
    [
      'agents/reviewer.md',
      generated(
        `${pi(input.roles.reviewer)}\n\n${input.roleSkills.reviewer}`,
        PI_FRONTMATTER.reviewer,
      ),
    ],
    ['skills/maestria/SKILL.md', generated(pi(input.roles['main-loop']), PI_FRONTMATTER.maestria)],
    ['skills/global-rules/SKILL.md', generated(pi(input.rules), PI_FRONTMATTER['global-rules'])],
  ]);
  for (const [mode, { source }] of Object.entries(input.modes)) {
    files.set(`agents/commands/${mode}.md`, generated(pi(source)));
  }
  return files;
};

export const nativeAdapterOutputs = (
  input: NativeInputs,
  roles: readonly string[],
): Record<string, Map<string, string>> => ({
  'packages/opencode': opencodeFiles(input),
  'packages/pi': piFiles(input, roles),
});
