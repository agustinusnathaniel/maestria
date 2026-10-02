// packages/core/scripts/lib/agent-directive-sync.ts - Shared sync config for
// platforms that project the canonical specialists to agent files and skills.
//
// Pi and OMP deploy the same directive mapping. Their configs pass only the
// values that differ: the @-mention rewrite prefix, the product name in the
// global-rules description, and the host tool names their projection filters
// against. Relative paths resolve against the importing sync.config.ts.

import { specialistReferenceReplacements } from './specialist-replacements.js';
import type { SyncConfig } from './config.js';

export interface AgentDirectiveSyncOptions {
  /** Prefix for rewritten specialist mentions: '/name' for pi, 'name' for omp. */
  commandPrefix: string;
  /** Product name in the generated global-rules description. */
  agentFamily: string;
  /**
   * Builtin tool names the target host actually registers. The emitted `tools:`
   * frontmatter is the declared list intersected with this, so a declared name
   * the host does not register cannot ship as an inert filter entry. Omit to
   * pass every declared name through unchanged.
   */
  hostTools?: readonly string[];
}

/**
 * Tool names each specialist needs, by agent file. The native profile enforces
 * this list; prompts alone cannot prevent shell mutation. A name absent from
 * `hostTools` is dropped rather than substituted, because an unregistered tool
 * name is inert, not an alias for a different capability.
 */
const DECLARED_TOOLS = {
  'adventurer.md': ['read', 'grep', 'find', 'ls', 'glob'],
  'architect.md': ['read', 'bash', 'grep', 'find', 'ls'],
  'builder.md': ['read', 'bash', 'grep', 'find', 'ls', 'write', 'edit'],
  'diagnose.md': ['read', 'bash', 'grep', 'find', 'ls'],
  'planner.md': ['read', 'grep', 'find', 'ls'],
  'reviewer.md': ['read', 'grep', 'find', 'ls', 'glob'],
  'writer.md': ['read', 'bash', 'grep', 'find', 'ls', 'write', 'edit'],
} as const satisfies Record<string, readonly string[]>;

/** Read-only sonar roles omit bash; architect/diagnose retain bash for evidence. */
const hostToolLine = (
  agentFile: keyof typeof DECLARED_TOOLS,
  hostTools: readonly string[] | undefined,
): string => {
  const declared = DECLARED_TOOLS[agentFile];
  const names =
    hostTools === undefined ? declared : declared.filter((name) => hostTools.includes(name));
  return `tools: ${names.join(', ')}\n`;
};

const agentFrontmatter = (fields: string): string => `---\n${fields}---\n\n`;

// oxlint-disable-next-line max-lines-per-function -- one declarative mapping: the shared 14-file directive table inlined as data. Splitting it would fragment a single reviewable mapping and hide the platform differences as parameters.
export const agentDirectiveSync = ({
  agentFamily,
  commandPrefix,
  hostTools,
}: AgentDirectiveSyncOptions): SyncConfig => ({
  default: {
    replace: specialistReferenceReplacements(commandPrefix),
    stripFrontmatter: true,
  },
  files: {
    // --- Canonical specialist agent types (7) ---

    'adventurer.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Codebase reconnaissance specialist. Maps unknown territory, traces\n` +
          `  call chains and dependencies, discovers module relationships, and\n` +
          `  produces structured recon reports for downstream specialists.\n${hostToolLine(
            'adventurer.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    'architect.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Architecture decision specialist. Evaluates implementation approaches\n` +
          `  with trade-off analysis, produces Architecture Decision Records (ADRs),\n` +
          `  and documents technical decisions with business context.\n${hostToolLine(
            'architect.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    'builder.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Focused implementation specialist. Executes one atomic, verifiable\n` +
          `  unit of work per invocation with minimal context and clean diffs.\n${hostToolLine(
            'builder.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    'commands/blitz.md': {
      output: 'commands/blitz.md',
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      output: 'commands/fein.md',
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      output: 'commands/sonar.md',
      stripFrontmatter: true,
    },

    'diagnose.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Bug tracing specialist. Follows relevant evidence\n` +
          `  from symptoms to root cause and prevention; expands to similar sites\n` +
          `  when the cause indicates a shared defect.\n${hostToolLine(
            'diagnose.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    'orchestrator.md': {
      output: '../skills/orchestrator/SKILL.md',
      prepend:
        '---\n' +
        'name: orchestrator\n' +
        'description: >-\n' +
        '  maestria agent orchestration dispatcher. Delegates work to 7 specialist\n' +
        '  subagents (adventurer, architect, builder, diagnose, planner, reviewer, writer)\n' +
        '  using spec-driven handoffs. Enforces maker/checker split, commit protocol,\n' +
        '  and role-based pipeline sequencing.\n' +
        '---\n' +
        '\n',
    },

    'planner.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Implementation planning specialist. Breaks complex features into\n` +
          `  phased milestones with dependencies, timelines, verification criteria,\n` +
          `  and rollback points.\n${hostToolLine('planner.md', hostTools)}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    'reviewer.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Code review specialist. Reviews for correctness, edge cases, security,\n` +
          `  performance, and maintainability in one general review. Adds specialist\n` +
          `  lenses only for matching security, performance, architecture, or UX risk;\n` +
          `  preserves blind review, lens exclusivity, and fix/dismiss/escalate triage.\n${hostToolLine(
            'reviewer.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    // rules.md found via secondary source loop from dirname(source) = ../core/agent-directives/
    'rules.md': {
      output: '../skills/global-rules/SKILL.md',
      prepend:
        '---\n' +
        'name: global-rules\n' +
        'description: >-\n' +
        '  Global behavioral constraints and best practices for maestria-powered\n' +
        `  ${agentFamily} agents. Covers orchestration conventions, delegation rules, context\n` +
        '  management, commit policy, pipeline patterns, and branch discipline.\n' +
        '---\n' +
        '\n',
    },
    'skills/handoff.md': {
      output: '../skills/handoff/SKILL.md',
      prepend:
        '---\n' +
        'name: handoff\n' +
        'description: >-\n' +
        '  The 7-field handoff contract for inter-specialist delegation.\n' +
        '  Load when receiving a task from another specialist, or when handing off work\n' +
        '  to the next stage in the pipeline.\n' +
        '---\n' +
        '\n',
    },

    'skills/iteration-limits.md': {
      output: '../skills/iteration-limits/SKILL.md',
      prepend:
        '---\n' +
        'name: iteration-limits\n' +
        'description: >-\n' +
        '  The iteration-limit pattern with verifiable termination and escalation format.\n' +
        '  Load when defining termination conditions for a loop, or when a loop is at risk of\n' +
        '  running too long.\n' +
        '---\n' +
        '\n',
    },
    'writer.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Documentation specialist. Creates clear, structured documentation\n` +
          `  following progressive disclosure patterns for READMEs, API docs,\n` +
          `  changelogs, and Architecture Decision Records.\n${hostToolLine(
            'writer.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },
  },
  output: 'agents',
  preserve: ['.gitkeep'],
  source: '../core/agent-directives/specialists',
});
