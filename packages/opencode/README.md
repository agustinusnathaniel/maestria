# @maestria/opencode

An OpenCode plugin that encodes learned AI-engineering patterns into a portable, self-wiring configuration.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope.

## Motivation

Raw LLMs are powerful but unreliable for production engineering work. They guess instead of verifying, implement instead of delegating, and produce plausible-sounding results that are subtly wrong. OpenCode's built-in agents give you a foundation, but they don't encode the methodology, discipline, and guardrails that turn a model into a reliable engineering partner.

This plugin exists to close that gap. It packages the harness - the rules, agents, and workflows - that makes AI engineering consistent and trustworthy. The principle is simple:

**Agent = Model + Harness**

The model provides capability. The harness provides reliability. Most agent failures are harness failures, not model failures.

The patterns in this plugin were extracted from months of daily AI-assisted engineering work. They represent configurations and workflows that survived repeated use - not theoretical best practices, but scar tissue from real failures. The orchestrator's delegation rules, the maker/checker split, the iteration limits, the `!!!` convention for non-negotiable rules - all of these came from specific failures that happened more than once.

This is not just another agent pack. Most agent packs focus on capability - giving agents more tools, more context, more autonomy. This plugin focuses on discipline: giving agents clear boundaries, explicit methodology, and structured handoffs. Capability is the default. Discipline is the differentiator.

To that end, the plugin is built on five design principles:

## Goals

- **Interoperability** - The methodology is harness-agnostic. Works with any LLM provider that OpenCode supports. No vendor lock-in, no model-specific prompt tricks.
- **Discipline** - Maker/checker split prevents self-approval. Iteration limits prevent infinite loops. Delegation chains prevent scope creep. These are first-class concepts, not afterthoughts.
- **Transparency** - Every agent is a markdown file with YAML frontmatter. Readable, editable, versionable. No TypeScript abstraction layer between you and the prompts. What you see is what the agent runs.
- **Evolvability** - Versioned releases encode new patterns as they're proven. The plugin improves by curation - patterns that survive repeated use get promoted; patterns that don't, don't.
- **Composability** - Agents are designed as pipeline stages. Adventurer discovers context, architect evaluates trade-offs, planner structures the work, builder implements, reviewer validates. The orchestrator chains them together. Each step produces a structured handoff for the next.

## Non-Goals

- **Does NOT bundle skills** - Skills (methodology packages for specific domains) are installed separately via the skills CLI. The plugin prescribes which skills to load and when, but does not include them.
- **Does NOT replace OpenCode's built-in agents** - `explore` and `general` remain available for unstructured work. The plugin's 8 subagents are specialists for structured workflows on top of that foundation.
- **Does NOT auto-extract patterns from sessions** - All rules and agent prompts are manually curated. No automated pattern extraction, no session mining, no implicit learning.
- **Does NOT require or provide a specific LLM provider** - Model selection is OpenCode configuration. No provider lock-in, no subscription or API key required. MIT-licensed, open source.
- **Does NOT work outside OpenCode** - This is an OpenCode plugin. Kimi Code and Hermes adaptations are in development as separate packages under the `@maestria` scope, each independently versioned and maintained.
- **Does NOT include telemetry, usage tracking, or external data collection** - No data leaves your machine. No analytics. No crash reporting. The plugin has zero network calls of its own.
- **Does NOT enforce rules programmatically** - Rules are guidance, not gates. The `!!!` convention signals non-negotiable rules, but the agent can still violate them. Enforcement happens through permissions and review, not runtime checks.

## What It Does

This plugin bundles a set of agents and rules that encode effective AI-engineering workflows:

- **Agents** - 8 specialized subagents for different phases of work:
  - `@orchestrator` - Manager for complex multi-step tasks; restricted to delegating only to the 7 registered subagents via task permissions
  - `@adventurer` - Codebase reconnaissance and deep code understanding before implementation
  - `@architect` - Architecture decisions with decision matrices
  - `@builder` - Focused implementation agent for atomic tasks
  - `@diagnose` - Systematic 6-step regression tracing
  - `@planner` - Create detailed implementation plans with phased milestones
  - `@reviewer` - Code review with quality gates
  - `@writer` - Documentation following structured patterns

- **Rules** - Global directives injected into every session's system prompt

## Installation

### Option 1: Via CLI (recommended)

Install globally (available in all projects):

```bash
opencode plugin @maestria/opencode@latest -g
```

Or install for the current project only:

```bash
opencode plugin @maestria/opencode@latest
```

### Option 2: Manual config

Add to your OpenCode config file:

- **Global:** `~/.config/opencode/opencode.jsonc`
- **Project-level:** `.opencode/opencode.jsonc` (in your project root)

```jsonc
{
  "plugin": ["@maestria/opencode@latest"],
}
```

To pin a specific version, use `"@maestria/opencode@0.3.3"` instead of `"@maestria/opencode@latest"`. Restart OpenCode after adding the plugin.

## How It Works

1. **Plugin loads** - OpenCode installs `@maestria/opencode` from npm
2. **Config hook** - The plugin reads bundled agent markdown files, parses their frontmatter, and registers them programmatically with OpenCode
3. **Rules injected** - `system.transform` hook appends rules to every session
4. **Agents available** - All 8 agents are available as subagents via `@` mention
5. **State preserved** - `session.compacting` hook preserves task status across compaction events

### Design Philosophy

This plugin is built on the **Harness Engineering** principle: `Agent = Model + Harness`. The harness is what turns a raw LLM into a reliable coding agent - the model is just one component.

The 6 harness components map directly to plugin features:

| Component         | Plugin Mapping                                |
| ----------------- | --------------------------------------------- |
| **Instructions**  | `rules/AGENTS.md` injected into every session |
| **Tools**         | Skill prescription system + MCP integration   |
| **Sandboxes**     | `permission` frontmatter on every agent       |
| **Orchestration** | `mode: all/subagent` + `task()` delegation    |
| **Guardrails**    | `edit: deny`, `bash: ask`, iteration limits   |
| **Observability** | Session compaction hooks, structured handoffs |

Most agent failures are configuration failures, not model failures. The plugin's agents are designed with this principle - precise rules, explicit boundaries, and clear delegation chains over raw capability.

## Updating

OpenCode does not auto-update plugins. Packages are cached locally at `~/.cache/opencode/packages/<name>@<version>/` - the npm registry is not consulted if the package is already cached. To update, re-run the install command with the same scope as the original install:

```bash
# If installed globally
opencode plugin @maestria/opencode@latest -g --force

# If installed at project level
opencode plugin @maestria/opencode@latest --force
```

Use `--force` to replace an existing config entry. To force a fresh install from npm (bypassing the local cache), clear the cache first:

**macOS / Linux:**

```bash
rm -rf ~/.cache/opencode/packages/@maestria/opencode*
```

**Windows (PowerShell):**

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\opencode\packages\@maestria\opencode*"
```

**Windows (Command Prompt):**

```cmd
rmdir /s /q "%USERPROFILE%\.cache\opencode\packages\@maestria"
```

Then re-run the install command (with or without `-g` as appropriate).

> **Tip:** Run `opencode debug paths` to see the cache directory resolved for your platform.

To pin a specific version, use `@<version>` instead of `@latest`:

```bash
opencode plugin @maestria/opencode@0.3.3
```

## Uninstalling

There is no CLI command to remove a plugin. To uninstall, edit your OpenCode config file and remove the entry from the `plugin` array:

- **Global:** `~/.config/opencode/opencode.jsonc`
- **Project-level:** `.opencode/opencode.jsonc` (in your project root)

```jsonc
{
  "plugin": [
    // Remove or comment out the line below:
    // "@maestria/opencode@latest",
  ],
}
```

You can also optionally delete the cached package:

```bash
rm -rf ~/.cache/opencode/packages/@maestria/opencode*
```

Alternatively, use the [maestria CLI](https://maestria.sznm.dev/cli/) to manage installation across all platforms from a single command.

## License

MIT
