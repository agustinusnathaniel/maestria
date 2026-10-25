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
  'reviewer.md': ['read', 'grep', 'find', 'ls', 'glob'],
} as const satisfies Record<string, readonly string[]>;

/** Read-only sonar roles omit bash; architect retains bash for evidence. */
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

// oxlint-disable-next-line max-lines-per-function -- one declarative mapping: the shared 11-file directive table inlined as data. Splitting it would fragment a single reviewable mapping and hide the platform differences as parameters.
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
    // --- Canonical specialist agent types (4) ---

    'adventurer.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Codebase reconnaissance specialist. Maps unknown territory, traces\n` +
          `  call chains, dependencies, and root causes, discovers module relationships,\n` +
          `  and produces structured recon reports for downstream specialists.\n${hostToolLine(
            'adventurer.md',
            hostTools,
          )}prompt_mode: append\n` +
          `inherit_context: true\n`,
      ),
    },

    'architect.md': {
      prepend: agentFrontmatter(
        `description: >-\n` +
          `  Architecture decision and planning specialist. Evaluates implementation\n` +
          `  approaches with trade-off analysis, produces Architecture Decision Records\n` +
          `  (ADRs) and phased plans, and documents decisions with business context.\n${hostToolLine(
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
          `  unit of work per invocation, including documentation, with minimal\n` +
          `  context and clean diffs.\n${hostToolLine(
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

    // Both utilities project one rules.md section, so the skills cannot drift from policy.
    handoff: {
      output: '../skills/handoff/SKILL.md',
      prepend:
        '---\n' +
        'name: handoff\n' +
        'description: >-\n' +
        '  Pass outcome, constraints, evidence, blockers, and next steps between workflow\n' +
        '  stages. Load when receiving a task from another specialist, or when handing off\n' +
        '  work to the next stage in the pipeline.\n' +
        '---\n' +
        '\n',
      section: 'Delegation and Context',
      source: '../core/agent-directives/rules.md',
    },
    'iteration-limits': {
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
      section: ['Repair Budget', 'Fail-Loud Repair'],
      source: '../core/agent-directives/rules.md',
    },
    'orchestrator.md': {
      output: '../skills/orchestrator/SKILL.md',
      prepend:
        '---\n' +
        'name: orchestrator\n' +
        'description: >-\n' +
        '  maestria agent orchestration dispatcher. Delegates work to 4 specialist\n' +
        '  subagents (adventurer, architect, builder, reviewer)\n' +
        '  using spec-driven handoffs. Enforces maker/checker split, commit protocol,\n' +
        '  and role-based pipeline sequencing.\n' +
        '---\n' +
        '\n',
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
  },
  output: 'agents',
  preserve: ['.gitkeep'],
  source: '../core/agent-directives/specialists',
});
