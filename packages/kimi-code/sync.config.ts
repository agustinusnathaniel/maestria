// packages/kimi-code/sync.config.ts
// Sync config: derives kimi-code skill files from canonical core directives

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  default: {
    replace: [
      { from: '@adventurer', to: 'adventurer' },
      { from: '@architect', to: 'architect' },
      { from: '@builder', to: 'builder' },
      { from: '@diagnose', to: 'diagnose' },
      { from: '@planner', to: 'planner' },
      { from: '@reviewer', to: 'reviewer' },
      { from: '@writer', to: 'writer' },
      { from: 'task(', to: 'Agent(' },
      { from: '@orchestrator', to: 'orchestrator' },
      { from: 'webfetch', to: 'FetchURL' },
      { from: 'grep(', to: 'Grep(' },
      { from: 'glob(', to: 'Glob(' },
      { from: 'question(', to: 'AskUserQuestion(' },
      { from: '`webfetch`', to: '`FetchURL`' },
      { from: 'websearch', to: 'WebSearch' },
      { from: '`read`', to: '`Read`' },
      { from: '`glob`', to: '`Glob`' },
      { from: '`grep`', to: '`Grep`' },
      { from: '`lsp`', to: 'a language server protocol' },
      { from: 'Related Agents', to: 'Related Skills' },
      { from: '`edit`', to: '`Edit`' },
      { from: '`write`', to: '`Write`' },
      { from: 'run in parallel', to: 'run in parallel via `AgentSwarm`' },
    ],
  },
  files: {
    'adventurer.md': {
      frontmatter: {
        arguments: [],
        description: `Codebase reconnaissance agent for deep code understanding.
Maps unknown territory - traces call chains, maps module relationships,
generates structured reports for downstream specialists.
Use for: understanding unfamiliar code, tracing dependencies, gathering
context before implementation, investigating module structures.
One role per session: exploration only - never implement or design.`,
        name: 'adventurer',
        type: 'prompt',
        whenToUse: `Understanding unfamiliar code, tracing dependencies, mapping a module
before editing it. Use before any implementation in unknown territory.
Read-only - never implement, design, or edit.`,
      },
      output: 'adventurer/SKILL.md',
      prepend:
        '**Subagent profile:** `explore` - you have Read, Glob, Grep, Bash, WebSearch, and FetchURL. You do **not** have Write or Edit.\n\n',
    },
    'architect.md': {
      frontmatter: {
        arguments: [],
        description: `Architecture decisions using decision matrices and ADRs.
Evaluates options with weighted criteria, clarifies business context first.
Use for: technology choices, implementation approaches, trade-off analysis.`,
        name: 'architect',
        type: 'prompt',
        whenToUse: `Technology choices, comparing approaches, "should we use X or Y",
evaluating options with long-term consequences. Use when more than
one approach is viable and the choice has downstream impact.`,
      },
      output: 'architect/SKILL.md',
      prepend:
        '**Subagent profile:** `plan` - you have Read, Glob, Grep, WebSearch, and FetchURL. You do **not** have Bash, Write, or Edit.\n\n',
    },
    'builder.md': {
      frontmatter: {
        arguments: [],
        description: `Focused implementation agent for atomic tasks.
Executes one verifiable unit of work with minimal context.
Use for: targeted fixes, feature implementation, refactors, adding tests.`,
        name: 'builder',
        type: 'prompt',
        whenToUse: `Feature implementation, bug fixing, test writing, refactoring within a
single task scope. Use when the design is clear, recon is done, and the
work is a concrete atomic unit.`,
      },
      output: 'builder/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` - you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them to implement the task.\n\n',
    },
    'commands/blitz.md': {
      frontmatter:
        "---\nname: blitz\ndescription: 'Fast implementation mode: skip optional recon/design unless unknown; required review remains'\n---\n",
      output: '../commands/blitz.md',
      prepend:
        '**Workflow command:** use the fastest safe route allowed by the active Kimi profile, while retaining required review.\n\n',
      replace: [
        { from: '@adventurer', to: 'adventurer' },
        { from: '@builder', to: 'builder' },
        { from: '@reviewer', to: 'reviewer' },
      ],
      stripFrontmatter: true,
    },
    'commands/fein.md': {
      frontmatter:
        "---\nname: fein\ndescription: 'Full pipeline mode: recon, design, implement, review'\n---\n",
      output: '../commands/fein.md',
      prepend:
        '**Workflow command:** use the Kimi Agent and its native Agent/AgentSwarm tools as permitted by the active profile.\n\n',
      replace: [
        { from: '@adventurer', to: 'adventurer' },
        { from: '@architect', to: 'architect' },
        { from: '@builder', to: 'builder' },
        { from: '@planner', to: 'planner' },
        { from: '@reviewer', to: 'reviewer' },
      ],
      stripFrontmatter: true,
    },
    'commands/sonar.md': {
      frontmatter:
        "---\nname: sonar\ndescription: 'Research-only mode: recon and design, no implementation'\n---\n",
      output: '../commands/sonar.md',
      prepend:
        '**Workflow command:** keep this route read-only and stop before implementation.\n\n',
      replace: [
        { from: '@adventurer', to: 'adventurer' },
        { from: '@architect', to: 'architect' },
        { from: '@planner', to: 'planner' },
      ],
      stripFrontmatter: true,
    },
    'diagnose.md': {
      frontmatter: {
        arguments: [],
        description: `Systematic 6-step regression tracing.
From error message to root cause to prevention.
Use for: cryptic errors, regressions, production bugs.`,
        name: 'diagnose',
        type: 'prompt',
        whenToUse: `Regressions, cryptic errors, performance issues, "why is X happening",
post-incident work. Use when the symptom is visible but the cause is
not.`,
      },
      output: 'diagnose/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` - you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them to investigate.\n\n',
    },
    'orchestrator.md': {
      append: `

## Specialist → Subagent Routing

| Persona | Subagent Type | Role | When |
|---------|--------------|------|------|
| adventurer | \`explore\` | Gather data; describe the terrain | Before any implementation in unfamiliar code |
| architect | \`plan\` | Evaluate options; document decisions | When multiple approaches exist |
| builder | \`coder\` | Implement; test; refactor | When the design is locked |
| diagnose | \`coder\` | Find root cause; write regression test | When something is broken |
| planner | \`plan\` | Break down work; sequence milestones | Before starting a multi-step feature |
| reviewer | \`plan\` | Review; QA; check correctness | After the integrated builder batch is reconciled; general review first, then risk-matched lenses sequentially |
| writer | \`coder\` | Document APIs; write README; create ADRs | When code needs human-facing docs |

## Swarm Usage (AgentSwarm)

When 2+ items are uniform (same persona, same goal, independent units), use \`AgentSwarm\` instead of \`Agent\`. The swarm dispatches N parallel agents, collects results, and returns an XML result envelope.

### When to use AgentSwarm

- N≥3 files need the same type of change (e.g., "add JSDoc to every model")
- Multiple independent explorations (e.g., "check 5 different approaches")
- Bulk data extraction from known directories
- NOT for mixed-persona work, chain-of-thought sequences, or work where results depend on each other

### How AgentSwarm works

\`\`\`
AgentSwarm(
  description: "Review independent files",
  subagent_type: "coder",
  prompt_template: "Review {{item}} for correctness and test gaps.",
  items: ["src/a.ts", "src/b.ts"]
)
\`\`\`

Array elements run in parallel. Each gets its own context snapshot. Results are gathered after all complete.

### Exclusive-deny policy

When using AgentSwarm, only the orchestrator may talk to the user. Swarm agents must not use \`AskUserQuestion\`. Gather all context up front, dispatch, then report.

### Result envelope

Each swarm result is returned in Kimi's XML envelope. Read the per-item status and handoff text before deciding whether to continue or repair.

## Background Sub-Agents

You may launch \`Agent(prompt: "research this", description: "Explore the question", subagent_type: "explore", run_in_background: true)\` as a background investigation while continuing other work. Background agents run concurrently and report back.

## How to Invoke a Specialist Persona

1. \`Skill(skill="adventurer")\` - Load the specialist persona (defines constraints, rules, and subagent profile for that role)
2. \`Agent(prompt: "...", description: "Short task label", subagent_type: "coder")\` - Delegate a unit of work to the mapped built-in profile
3. \`AgentSwarm(description: "...", subagent_type: "coder", prompt_template: "... {{item}} ...", items: [...])\` - Delegate uniform items in parallel

### Why the two-step pattern?

The \`Skill\` call loads persona-specific context (rules, tools, behavioral constraints). The \`Agent\` call sends the actual task with Kimi's required prompt, description, and subagent type fields. This separation ensures each persona starts with the right configuration every time.

### Subagent profile vs persona

The \`explore\` subagent has read-only search tools. The \`coder\` subagent has full Write/Edit access. The \`plan\` subagent is read-only and has no shell access.

### Single-agent pattern

\`\`\`
// 1. Load the persona
const result = await Skill(skill: "diagnose");
if (result.status !== "ok") { AskUserQuestion("..."); return; }

// 2. Dispatch the task
const output = await Agent(
  prompt: "Find why X fails",
  description: "Diagnose failure",
  subagent_type: "coder"
);
if (output.result) { /* use the complete handoff */ }
\`\`\`

### Swarm pattern

\`\`\`
const results = await AgentSwarm(
  description: "Update independent files",
  subagent_type: "coder",
  prompt_template: "Update {{item}} and run its focused checks.",
  items: ["src/a.ts", "src/b.ts", "src/c.ts"]
);
// Read the XML result envelope and handle failed items explicitly.
\`\`\`

## Anti-Patterns (additional)

7. **Swarm mixed personas** - Each AgentSwarm must use a single persona. Different work = different swarms.
8. **Tool-call bundling with AgentSwarm** - Swarm agents are autonomous; don't micromanage their tool calls.
9. **Fixed-pipeline thinking** - Not every task needs all 7 specialists. Skip what you don't need.

## Related Skills

- \`adventurer\` - Codebase reconnaissance
- \`architect\` - Architecture decisions + ADRs
- \`builder\` - Focused implementation
- \`diagnose\` - 6-step bug tracing
- \`planner\` - Multi-phase plans
- \`reviewer\` - Code review with quality gates
- \`writer\` - Documentation

## Skill Prescription

**Always load:** \`architecture-decision-records\`, \`improve\`, \`session-handoff\`

**Load on trigger:** \`cavecrew\`, \`caveman-review\`, \`caveman-stats\`, \`customize-opencode\`, \`handoff\`, \`impeccable\`, \`mermaid-diagrams\`, \`prioritizing-roadmap\`, \`technical-roadmaps\`, \`to-prd\`, \`vite\`, \`vitest\`, \`writing-prds\`

**Defer (load only after context is collected):** \`to-issues\`, \`triage\`

**Skip:** \`commit-work\` (orchestrator never commits), \`dedicated-tests\` (covered by builder)

### Pre-load before dispatch

Before delegating to a specialist via \`Skill\`, load the skill first. If the \`Skill\` tool is not available to the subagent profile, inline the persona's core content directly:

The \`Skill\` tool is only available to \`plan\` and \`coder\` profiles. For \`explore\` subagents, pre-load the persona content before dispatch.

### Miss handling

If a subagent reports it cannot find a skill, load it via \`Skill\` first, or install it if needed. Never rely on the subagent to have skills pre-loaded.

## Handoff

To compact the conversation for transfer, output:

\`\`\`
## State
- Done: [list]
- Pending: [list]
- Blockers: [list]
- Stack: [files changed, decisions made, key context]
\`\`\`

This should appear at the end of your response when the user asks for a handoff, or when context pressure requires a fresh agent.
`,
      frontmatter: {
        arguments: [],
        description: 'Methodology + delegation + swarm usage for the maestria workflow',
        name: 'orchestrator',
        type: 'prompt',
        whenToUse: `Multi-step or multi-file work, or any task spanning N≥3 independent items.
Also: implementation planning, code review, debugging sessions, architecture
decisions, and documentation generation under the maestria workflow.`,
      },
      output: 'orchestrator/SKILL.md',
      prepend:
        '**Subagent profile:** `plan` - you have Read, Glob, Grep, FetchURL, and WebSearch. You do **not** have Bash, Write, or Edit.\n\n',
    },
    'planner.md': {
      frontmatter: {
        arguments: [],
        description: `Create detailed implementation plans with phased dependencies, timelines, and success criteria.
Breaks down complex features into verifiable milestones.
Use for: complex features requiring multi-phase execution, when the plan needs review before building.`,
        name: 'planner',
        type: 'prompt',
        whenToUse: `Multi-phase features requiring ordered work, migrations, rollouts, or
any complex feature that needs review before building.`,
      },
      output: 'planner/SKILL.md',
      prepend:
        '**Subagent profile:** `plan` - you have Read, Glob, Grep, WebSearch, and FetchURL. You do **not** have Bash, Write, or Edit.\n\n',
    },
    'reviewer.md': {
      frontmatter: {
        arguments: [],
        description: `Code review with quality gates.
Reviews code for correctness, edge cases, security, performance, maintainability,
and adherence to conventions. Provides specific, actionable feedback.
Use for: PR review, pre-commit review, architecture document review.`,
        name: 'reviewer',
        type: 'prompt',
        whenToUse: `Pre-merge review, post-implementation validation, security audits,
before-commit QA. In full routes, review after the integrated builder batch is
reconciled; run the general review first, then risk-matched lenses sequentially.`,
      },
      output: 'reviewer/SKILL.md',
      prepend:
        '**Subagent profile:** `plan` - you have Read, Glob, Grep, WebSearch, and FetchURL. You do **not** have Bash, Write, or Edit.\n\n',
    },
    'rules.md': {
      output: '../SYSTEM.md',
      prepend:
        '<!-- Auto-generated from @maestria/core. See the canonical file at packages/core/agent-directives/rules.md. -->\n',
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules - @maestria/kimi-code' },
        { from: '`read`', to: '`Read`' },
        { from: '`glob`', to: '`Glob`' },
        { from: '`grep`', to: '`Grep`' },
        { from: '`bash`', to: '`Bash`' },
        { from: '`lsp`', to: 'language server protocol' },
        { from: '`bash --help`', to: '`Bash --help`' },
        { from: 'treat it seriously.', to: 'treat it seriously, not a preference.' },
        { from: 'websearch', to: 'WebSearch' },
        { from: 'read-only', to: 'Read-only' },
        // Add Kimi's built-in-agent guard after the canonical delegation
        // heading. Re-anchored 2026-08: the heading is "## Delegation and
        // Context"; the old '## Delegation\n' anchor silently no-op'd. The
        // guard names the seven personas because the revised canonical rules
        // body no longer carries the specialist roster.
        {
          from: '## Delegation and Context\n',
          to: '## Delegation and Context\n\nWhen delegating through `Agent()` or `AgentSwarm()`, use only the seven specialist personas - adventurer, architect, builder, diagnose, planner, reviewer, writer. Never substitute platform-native built-in agents unless this mapping explicitly authorizes it.\n',
        },
      ],
    },
    'writer.md': {
      frontmatter: {
        arguments: [],
        description: `Documentation writing following structured patterns.
Creates clear, comprehensive docs for code, APIs, systems.
Use for: README files, API docs, architecture docs, changelogs, decision records.`,
        name: 'writer',
        type: 'prompt',
        whenToUse: `"Document this", "write README", "ADR", "changelog", "API docs",
"explain in prose". Turning code into human-readable artifacts.`,
      },
      output: 'writer/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` - you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them to produce docs.\n\n',
    },
  },
  output: 'skills',
  source: '../core/agent-directives/specialists',
} satisfies SyncConfig;
