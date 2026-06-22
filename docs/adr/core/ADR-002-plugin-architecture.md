# ADR-002: Plugin Architecture — Pure Plugin, Markdown Agents, 2 Hooks

## Status

Accepted

## Context

We needed to decide how `@maestria/opencode` delivers its agents, rules, and
skills to the user's OpenCode installation. Three approaches were considered:

1. **File-copy approach** — npm postinstall script copies files to
   `~/.config/opencode/` (agents to `agents/`, rules as `AGENTS.md`,
   skills to `skills/`)
2. **Config-only approach** — no plugin code, just markdown files that the
   user manually copies or links (inspired by `opencode-agent-orchestration-kit`)
3. **Pure plugin approach** — plugin registers agents via `config` hook,
   injects rules via `input.instructions` inside the `config` hook, preserves
   state via `session.compacting`. Only the npm package is installed — no
   filesystem side effects outside the package directory.

We studied reference implementations for patterns:

- **Config-only packages** — no plugin code, just markdown files that the user
  manually copies or links (e.g., `opencode-agent-orchestration-kit`)

## Decision

### Choose: Pure Plugin Approach (Option 3)

**The plugin is pure hooks.** It registers agents programmatically via the
`config` hook, injects rules via `input.instructions` inside the `config` hook,
and preserves session state via `session.compacting`. No postinstall script, no
file copying, no filesystem side effects.

### Key Architecture Decisions

| Decision                | Choice                                                                           | Rationale                                                                              |
| ----------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Agent format**        | Markdown files with YAML frontmatter                                             | Readable, editable, versionable. No TypeScript factories needed.                       |
| **Agent registration**  | `config` hook reads agents/\*.md, parses frontmatter, injects into `input.agent` | Always current — no stale files.                                                       |
| **Number of hooks**     | Exactly 2                                                                        | `config`, `session.compacting`. More hooks = more surface area. We need 2.             |
| **Rules injection**     | `input.instructions` in `config` hook, not file copy                             | Rules always present regardless of user's existing AGENTS.md.                          |
| **Build tool**          | `tsc`                                                                            | Package is ~200 lines, no bundling needed. `tsdown` is a sledgehammer for a thumbtack. |
| **Skills distribution** | Not bundled; reference by name                                                   | Skills are installed separately via `pnpx skills@latest add`. Keeps plugin focused.    |
| **Postinstall**         | None                                                                             | Pure plugin has no side effects outside the npm package directory.                     |

### What We Avoid (learned from reference implementations)

| Anti-pattern               | Why Not                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| TypeScript agent factories | Markdown is editable, inspectable, versionable. We use .md files, not TS factories. |
| 10+ lifecycle hooks        | 2 hooks cover the need; more hooks = more maintenance surface.                      |
| Postinstall file copying   | Creates stale files, requires sentinel checks, fragile.                             |
| Greek mythology naming     | Functional naming (architect, diagnose, builder) tells you what the agent does.     |
| Telemetry / usage tracking | Privacy-invasive, adds no value to the user.                                        |
| Subscription / auth gating | Open-source, MIT license, no gatekeeping.                                           |
| Package sprawl             | 1 package, focused scope.                                                           |

## Consequences

- Positive: No stale files after updates. Agents are always exactly what the
  plugin version defines.
- Positive: No overwrite logic or sentinel checks. 0 filesystem side effects.
- Positive: Agents editable by users with any text editor — no TypeScript
  compilation needed to modify agent behavior.
- Positive: Compatible with any provider/model — no vendor lock-in.
- Negative: Must parse YAML frontmatter at runtime (via `yaml` library).
- Negative: Agents not visible as loose files in user's config directory
  (they're loaded from the npm package, not from `~/.config/opencode/agents/`).
- Negative: Package must include `agents/` and `rules/` in the npm `files` array
  so the plugin can read them at runtime.

## Agent Config Shape

Derived from `@opencode-ai/sdk` types:

```typescript
type AgentConfig = {
  prompt: string;
  description: string;
  mode: 'subagent' | 'primary' | 'all';
  color?: string;
  maxSteps?: number;
  permission?: {
    edit?: 'ask' | 'allow' | 'deny';
    bash?: 'ask' | 'allow' | 'deny' | { [key: string]: 'ask' | 'allow' | 'deny' };
    webfetch?: 'ask' | 'allow' | 'deny';
    // ... more actions
  };
};
```

Each agent file has this as YAML frontmatter, parsed at plugin load time.

## Plugin API

From `@opencode-ai/plugin@1.17.4`:

```typescript
// Config hook — mutate input.agent to register agents and inject rules
config: async (input: Config) => void;

// Session compacting — preserve task state
"experimental.session.compacting": async (input, output) => {
  output.context: string[]; // push state strings
};
```

## Date

2026-06-12
