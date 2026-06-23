# Session Notes: 2026-06-12 — Building @maestria/opencode

## Overview

Built `@maestria/opencode` npm plugin from scratch. This session included the
initial implementation, two major architectural pivots, and multiple agent
definition iterations. These notes capture the mistakes, decisions, and learnings
so future sessions don't repeat them.

---

## Mistakes Made

### 1. File-Copy Agent Registration (First Approach)

**What we did:** Started with a `postinstall` script that copied agent markdown
files to `~/.config/opencode/agents/` and rules to `~/.config/opencode/AGENTS.md`.

**Why it was wrong:**

- Creates stale files after updates (overwrite logic needed)
- Requires sentinel checks to avoid overwriting user modifications
- User asked: "how come other plugins don't modify my .opencode config?"
- The answer: the `config` hook can register agents programmatically without
  copying files

**What we switched to:** Programmatic registration via `config` hook. The plugin
reads bundled `agents/*.md` files, parses YAML frontmatter, and injects them into
`input.agent` at runtime. No filesystem side effects outside the npm package.

### 2. Shallow Initial Agent Definitions

**What we did:** First draft of agents had 5 agents with very shallow prompts
(30-50 lines each, basic descriptions without methodology).

**Why it was wrong:**

- User feedback: "I felt the skills are still too shallow"
- User feedback: "reviewer agent is still too shallow"
- Not leveraging the rich my-base KB that was the whole point of this project

**What we switched to:** Read 7 my-base KB files thoroughly:

- `agent-patterns.mdx` — workflow archetypes, implicit rules, escalation ladder
- `directive-library.mdx` — reusable directives, `!!!` prefix, composition
- `workflows.mdx` — iterative refinement, model tiering, guard rails, review cycle
- `loop-engineering.mdx` — maker/checker split, sub-agents, memory
- `orchestration.mdx` — pipeline, router, swarm patterns
- `code-review.mdx` — specific practices, questions to ask, references
- `installed-skills.mdx` — skill ecosystem, what's available

Then enriched all 7 agents with patterns from these sources.

### 3. Including Skills in Distribution

**What we did:** Copied 6 skills from `my-base/skills/` and included them in the
plugin distribution via postinstall.

**Why it was wrong:**

- User feedback: "skills are still too shallow, let's just remove this for now"
- Skills were shallow methodology wrappers that didn't add value vs. just
  referencing the skill name and letting users install via `skills.sh`

**What we switched to:** Removed skills entirely. Users install skills via:

```bash
pnpx skills@latest add <repo> -g -y --skill <name>
```

### 4. Wrong Hook API Assumption

**What we did:** First draft assumed `output.content` was an array of
`{type: 'text', text: string}` objects.

**What it actually is:** `output.system` is `string[]` — push strings directly.

**How we caught it:** Verified against `@opencode-ai/plugin@1.17.4` types.

### 5. Builder Agent with Arbitrary File Limit

**What we did:** Initially limited builder to "1-2 file edits" with a rule
"if change exceeds 2 files, stop and ask for orchestration."

**Why it was wrong:**

- User feedback: "why limit to 1-2 file edits only?"
- Arbitrary limits that don't map to real task boundaries

**What we switched to:** "Atomic task" scope — one bug fix, one feature slice,
one refactor. No arbitrary file count limits. The constraint is conceptual
(one concern per invocation), not quantitative.

### 6. Model Tiering in Global Rules

**What we did:** Included "Model tiering — Plan with a capable model, execute
with a cheaper one" in rules/AGENTS.md.

**Why it was wrong:**

- User feedback: "model tiering might not be applicable for everyone"
- Model tiering is a technique, not a universal rule. Some users have one
  model, some have specific provider constraints.

**What we switched to:** Removed from global rules. Model selection is
OpenCode user config, not a plugin-enforced directive.

### 7. Ambiguous Project Name Rule

**What we did:** "Don't mention project names as sources"

**Why it was wrong:**

- User feedback: "this might be ambiguous"
- Could mean "don't leak internal project names" or "don't cite projects as
  authoritative sources"

**What we switched to:** "Don't reference internal project names in explanations
— when describing patterns or sources, use generic descriptions."

---

## Key Decisions

All architectural decisions are documented as ADRs:

| ADR                                                             | Title               | What It Covers                                                                                  |
| --------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| [ADR-CORE-001](../adr/core/ADR-CORE-001-global-rules-scope.md)  | Global Rules Scope  | Three-way filter for rules: agent file vs global vs exclude                                     |
| [ADR-CORE-002](../adr/core/ADR-CORE-002-plugin-architecture.md) | Plugin Architecture | Pure plugin, markdown agents, programmatic registration, 3 hooks, build tool, no bundled skills |
| [ADR-CORE-003](../adr/core/ADR-CORE-003-agent-conventions.md)   | Agent Conventions   | `!!!` markers, cross-references, skill pattern, conventional comments                           |

---

## Technical Learnings

### Plugin API Types

From `@opencode-ai/plugin@1.17.4`:

```typescript
// Plugin type
export type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>;

// Config hook
export interface Hooks {
  config?: (input: Config) => Promise<void>;
  // Config is mutable — mutate in-place
}

// System transform hook
'experimental.chat.system.transform': async (input, output) => {
  output.system.push(line); // string[], not content parts
}

// Session compacting
'experimental.session.compacting': async (input, output) => {
  output.context.push(string); // string[]
}
```

### AgentConfig Shape

From `@opencode-ai/sdk`:

```typescript
export type AgentConfig = {
  model?: string;
  temperature?: number;
  prompt?: string;
  description?: string;
  mode?: 'subagent' | 'primary' | 'all';
  color?: string;
  maxSteps?: number;
  tools?: { [key: string]: boolean };
  permission?: {
    edit?: 'ask' | 'allow' | 'deny';
    bash?: 'ask' | 'allow' | 'deny' | { [key: string]: 'ask' | 'allow' | 'deny' };
    webfetch?: 'ask' | 'allow' | 'deny';
    // ... more actions
  };
};
```

### Workspace Build Pipeline

- `vp check` — runs formatting, lint, and type checking across ALL packages
- `vp check --fix` — auto-fixes formatting issues
- `npx tsc --noEmit` — type check only (no output)
- `npx tsc` — compiles to `dist/`
- Tests use `import { describe, it, expect } from "vite-plus/test"`

### Package Files

```json
"files": ["dist", "agents", "rules"]
```

The `dist/`, `agents/`, and `rules/` directories must be included in the
published package so the plugin can read them at runtime.

### Frontmatter Parsing

The custom parser must handle:

- `---` delimiters
- Nested YAML objects (bash permissions with wildcards)
- Multiline strings (description with line continuations)
- Empty lines and comments

Test: verify all 7 agents parse correctly with expected mode, description,
permission keys, and prompt length.

---

## Agent Evolution

| Agent            | Initial                     | Final                                                                         | Key Changes                         |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| **orchestrator** | 5-step process, basic rules | Added parallel execution, human-in-the-loop, anti-patterns                    | My-base orchestration patterns      |
| **architect**    | 5 phases, shortcut rules    | Added constraints, explicit assumptions, ADR template                         | Clarification before recommendation |
| **builder**      | "1-2 file edits" limit      | Atomic tasks, implementation staircase, constraint escalation                 | Removed arbitrary limits            |
| **diagnose**     | 6 steps                     | Added environment check, safety-first, documentation per step                 | Systematic debugging order          |
| **planner**      | Phased milestones           | Added guard rails, removed model tiering                                      | Progressive constraints             |
| **reviewer**     | 6 review axes               | 7 axes, self-review questions, severity classification, references            | Google code review guidelines       |
| **writer**       | Purpose/Usage/Details       | Added doc type patterns (README, API, ADR, changelog), progressive disclosure | Comprehensive documentation         |

---

## What to Remember for Next Time

### When Adding a New Agent

1. Read the relevant section in my-base KB first
2. Check `installed-skills.mdx` for related skill references
3. Include cross-references to other agents in the "Handoff" section
4. Add `Related Agents` table listing sibling agents and delegation triggers
5. Test frontmatter parsing with the manual test script

### When Modifying Rules

1. Apply the three-way filter (ADR-CORE-001)
2. If the rule is `!!!` level, ensure it's truly non-negotiable
3. Check if the rule is already covered by an agent's instructions
4. Keep global rules under 30 lines

### When Changing the Plugin

1. Run `vp check` after every meaningful batch of changes
2. Run `npx tsc --noEmit` from the package directory
3. Build with `npx tsc` and test the built output
4. Remember: the plugin reads files from `dist/` relative paths at runtime

### When Publishing

1. `vp run build` (prepublishOnly runs this)
2. Verify `files` array in package.json includes dist, agents, rules
3. Test on a fresh install: add to `opencode.jsonc`, restart, verify agents

---

## References

- My Personal Knowledge Base
- **Plugin docs**: https://opencode.ai/docs/plugins/
- **Agent docs**: https://opencode.ai/docs/agents/
- **Rules docs**: https://opencode.ai/docs/rules/

---

## Date

2026-06-12
