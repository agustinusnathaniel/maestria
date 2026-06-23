// packages/kimi-code/sync.config.ts
// Sync config: derives kimi-code skill files from canonical core directives

import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: 'skills',

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
      { from: 'read-only', to: 'Read-only' },
    ],
  },

  files: {
    'adventurer.md': {
      output: 'adventurer/SKILL.md',
      prepend:
        '**Subagent profile:** `explore` — you have Read, Glob, Grep, Bash, WebSearch, and FetchURL. You do **not** have Write or Edit.\n\n',
      frontmatter: {
        name: 'adventurer',
        description: `Codebase reconnaissance agent for deep code understanding.
Maps unknown territory — traces call chains, maps module relationships,
generates structured reports for downstream specialists.
Use for: understanding unfamiliar code, tracing dependencies, gathering
context before implementation, investigating module structures.
One role per session: exploration only — never implement or design.`,
        type: 'prompt',
        whenToUse: `Understanding unfamiliar code, tracing dependencies, mapping a module
before editing it. Use before any implementation in unknown territory.
Read-only — never implement, design, or edit.`,
        arguments: [],
      },
    },
    'architect.md': {
      output: 'architect/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` — you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them sparingly.\n\n',
      frontmatter: {
        name: 'architect',
        description: `Architecture decisions using decision matrices and ADRs.
Evaluates options with weighted criteria, clarifies business context first.
Use for: technology choices, implementation approaches, trade-off analysis.`,
        type: 'prompt',
        whenToUse: `Technology choices, comparing approaches, "should we use X or Y",
evaluating options with long-term consequences. Use when more than
one approach is viable and the choice has downstream impact.`,
        arguments: [],
      },
    },
    'builder.md': {
      output: 'builder/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` — you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them to implement the task.\n\n',
      frontmatter: {
        name: 'builder',
        description: `Focused implementation agent for atomic tasks.
Executes one verifiable unit of work with minimal context.
Use for: targeted fixes, feature implementation, refactors, adding tests.`,
        type: 'prompt',
        whenToUse: `Feature implementation, bug fixing, test writing, refactoring within a
single task scope. Use when the design is clear, recon is done, and the
work is a concrete atomic unit.`,
        arguments: [],
      },
    },
    'diagnose.md': {
      output: 'diagnose/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` — you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them to investigate.\n\n',
      frontmatter: {
        name: 'diagnose',
        description: `Systematic 6-step regression tracing.
From error message to root cause to prevention.
Use for: cryptic errors, regressions, production bugs.`,
        type: 'prompt',
        whenToUse: `Regressions, cryptic errors, performance issues, "why is X happening",
post-incident work. Use when the symptom is visible but the cause is
not.`,
        arguments: [],
      },
    },
    'planner.md': {
      output: 'planner/SKILL.md',
      prepend:
        '**Subagent profile:** `plan` — you have Read, Glob, Grep, Bash, WebSearch, and FetchURL. You do **not** have Write or Edit.\n\n',
      frontmatter: {
        name: 'planner',
        description: `Create detailed implementation plans with phased dependencies, timelines, and success criteria.
Breaks down complex features into verifiable milestones.
Use for: complex features requiring multi-phase execution, when the plan needs review before building.`,
        type: 'prompt',
        whenToUse: `Multi-phase features requiring ordered work, migrations, rollouts, or
any complex feature that needs review before building.`,
        arguments: [],
      },
    },
    'reviewer.md': {
      output: 'reviewer/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` — you have Read, Glob, Grep, Bash, WebSearch, and FetchURL. You do **not** have Write or Edit.\n\n',
      frontmatter: {
        name: 'reviewer',
        description: `Code review with quality gates.
Reviews code for correctness, edge cases, security, performance, maintainability,
and adherence to conventions. Provides specific, actionable feedback.
Use for: PR review, pre-commit review, architecture document review.`,
        type: 'prompt',
        whenToUse: `Pre-merge review, post-implementation validation, security audits,
before-commit QA. Use after \`builder\` lands a code change.`,
        arguments: [],
      },
    },
    'writer.md': {
      output: 'writer/SKILL.md',
      prepend:
        '**Subagent profile:** `coder` — you have Write, Edit, Read, Glob, Grep, Bash, WebSearch, FetchURL, and `mcp__*` tools. Use them to produce docs.\n\n',
      frontmatter: {
        name: 'writer',
        description: `Documentation writing following structured patterns.
Creates clear, comprehensive docs for code, APIs, systems.
Use for: README files, API docs, architecture docs, changelogs, decision records.`,
        type: 'prompt',
        whenToUse: `"Document this", "write README", "ADR", "changelog", "API docs",
"explain in prose". Turning code into human-readable artifacts.`,
        arguments: [],
      },
    },
    'orchestrator.md': {
      output: 'orchestrator/SKILL.md',
      prepend:
        '**Subagent profile:** `plan` — you have Read, Glob, Grep, Bash, FetchURL, and WebSearch. You do **not** have Write or Edit.\n\n',
      frontmatter: {
        name: 'orchestrator',
        description: 'Methodology + delegation + swarm usage for the maestria workflow',
        type: 'prompt',
        whenToUse: `Multi-step or multi-file work, or any task spanning N≥3 independent items.
Also: implementation planning, code review, debugging sessions, architecture
decisions, and documentation generation under the maestria workflow.`,
        arguments: [],
      },
      append: `

## Specialist → Subagent Routing

| Persona | Subagent Type | Role | When |
|---------|--------------|------|------|
| adventurer | \`explore\` | Gather data; describe the terrain | Before any implementation in unfamiliar code |
| architect | \`coder\` | Evaluate options; document decisions | When multiple approaches exist |
| builder | \`coder\` | Implement; test; refactor | When the design is locked |
| diagnose | \`coder\` | Find root cause; write regression test | When something is broken |
| planner | \`coder\` | Break down work; sequence milestones | Before starting a multi-step feature |
| reviewer | \`plan\` | Review; QA; check correctness | After builder lands a change |
| writer | \`coder\` | Document APIs; write README; create ADRs | When code needs human-facing docs |

## Swarm Usage (AgentSwarm)

When 3+ items are uniform (same persona, same goal, independent units), use \`AgentSwarm\` instead of \`Agent\`. The swarm dispatches N parallel agents, collects results, and returns them as a structured array.

### When to use AgentSwarm

- N≥3 files need the same type of change (e.g., "add JSDoc to every model")
- Multiple independent explorations (e.g., "check 5 different approaches")
- Bulk data extraction from known directories
- NOT for mixed-persona work, chain-of-thought sequences, or work where results depend on each other

### How AgentSwarm works

\`\`\`
AgentSwarm(persona: "builder", data: [...], prompt: "...")
  → [{status, files, summary}, ...]
\`\`\`

Array elements run in parallel. Each gets its own context snapshot. Results are gathered after all complete.

### Exclusive-deny policy

When using AgentSwarm, only the orchestrator may talk to the user. Swarm agents must not use \`AskUserQuestion\`. Gather all context up front, dispatch, then report.

### Result envelope

Each swarm agent returns: \`{status: "ok"|"error", files: string[], summary: string}\`. The orchestrator reads the envelope and decides next steps.

## Background Sub-Agents

You may launch \`Agent(persona: "explore", task: "research this")\` as a background investigation while continuing other work. Background agents run concurrently and report back. Signal completion by returning a structured result.

## How to Invoke a Specialist Persona

1. \`Skill(skill="adventurer")\` — Load the specialist persona (defines constraints, rules, and subagent profile for that role)
2. \`Agent(persona: "...", data: {...}, prompt: "...")\` — Delegate a unit of work to the persona
3. \`AgentSwarm(persona: "...", data: [...], prompt: "...")\` — Delegate N uniform items to parallel persona instances

### Why the two-step pattern?

The \`Skill\` call loads persona-specific context (rules, tools, behavioral constraints). The \`Agent\` call sends the actual task. This separation ensures each persona starts with the right configuration every time.

### Subagent profile vs persona

The \`explore\` subagent has Read-only tools. The \`coder\` subagent has full Write/Edit. The \`plan\` subagent is Read-only with Bash access.

### Single-agent pattern

\`\`\`
// 1. Load the persona
const result = await Skill(skill: "diagnose");
if (result.status !== "ok") { AskUserQuestion("..."); return; }

// 2. Dispatch the task
const output = await Agent(persona: "diagnose", data: ctx, prompt: "Find why X fails");
if (output.status === "ok") { /* use output.files, output.summary */ }
\`\`\`

### Swarm pattern

\`\`\`
const items = [
  { path: "src/a.ts", desc: "..." },
  { path: "src/b.ts", desc: "..." },
  { path: "src/c.ts", desc: "..." },
];

const results = await AgentSwarm(persona: "builder", data: items, prompt: "Update each file");
for (const r of results) {
  if (r.status !== "ok") { /* handle */ }
}
\`\`\`

## Anti-Patterns (additional)

7. **Swarm mixed personas** — Each AgentSwarm must use a single persona. Different work = different swarms.
8. **Tool-call bundling with AgentSwarm** — Swarm agents are autonomous; don't micromanage their tool calls.
9. **Fixed-pipeline thinking** — Not every task needs all 7 specialists. Skip what you don't need.

## Related Skills

- \`adventurer\` — Codebase reconnaissance
- \`architect\` — Architecture decisions + ADRs
- \`builder\` — Focused implementation
- \`diagnose\` — 6-step bug tracing
- \`planner\` — Multi-phase plans
- \`reviewer\` — Code review with quality gates
- \`writer\` — Documentation

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
    },

    'rules.md': {
      output: '../rules/AGENTS.md',
      prepend:
        '<!-- Auto-generated from @maestria/core. See the canonical file at packages/core/agent-directives/rules.md. -->\n\n',
      replace: [
        { from: '# Global Agent Rules', to: '# Global Agent Rules \u2014 @maestria/kimi-code' },
        { from: '`read`', to: '`Read`' },
        { from: '`glob`', to: '`Glob`' },
        { from: '`grep`', to: '`Grep`' },
        { from: '`bash`', to: '`Bash`' },
        { from: '`lsp`', to: 'a language server tool' },
        { from: 'bash --help', to: 'Bash --help' },
        { from: 'treat it seriously.', to: 'treat it seriously, not a preference.' },
        { from: 'websearch', to: 'WebSearch' },
        { from: 'read-only', to: 'Read-only' },
        // Replace the canonical delegation section (post-default-transform) with a kimi-code version
        {
          from: `## Delegation

When delegating work via \`Agent()\`, use only the 7 specialists below.
**Never delegate to \`explore\` or \`general\`** — they are built-in agents,
not part of the pipeline.

| Agent         | Role                                             | When to Delegate                                                                             |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| \`adventurer\` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| \`architect\`  | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation                                           |
| \`builder\`    | Focused implementation, single-task execution    | Feature work, bug fixes, test writing, refactors                                             |
| \`diagnose\`   | Systematic bug tracing, root cause analysis      | Debugging regressions, production incidents, cryptic errors                                  |
| \`planner\`    | Implementation plans with phased milestones      | Complex features requiring structured execution                                              |
| \`reviewer\`   | Code review with quality gates                   | Pre-merge review, security audit, post-implementation QA                                     |
| \`writer\`     | Documentation following structured patterns      | READMEs, API docs, changelogs, ADR transcription                                             |

`,
          to: `## Delegation

When delegating work via \`Agent()\` (single item) or \`AgentSwarm()\` (≥3 uniform items), use only the 7 specialist personas below. Each maps to a subagent type (\`coder\`, \`explore\`, or \`plan\`) via the orchestrator's routing table.

| Persona      | Subagent Type | Role                                             |
| ------------ | ------------- | ------------------------------------------------ |
| \`adventurer\` | \`explore\`     | Codebase reconnaissance, deep code understanding |
| \`architect\`  | \`coder\`       | Architecture decisions, trade-off analysis, ADRs |
| \`builder\`    | \`coder\`       | Focused implementation, single-task execution   |
| \`diagnose\`   | \`coder\`       | Systematic bug tracing, root cause analysis     |
| \`planner\`    | \`plan\`        | Implementation plans with phased milestones     |
| \`reviewer\`   | \`coder\`       | Code review with quality gates                  |
| \`writer\`     | \`coder\`       | Documentation following structured patterns     |

`,
        },
      ],
    },
  },
} satisfies SyncConfig;
