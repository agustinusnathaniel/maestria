# Maestria Vision

## Motivation

AI coding agents - OpenCode, Claude Code, Codex, Kimi Code - provide excellent infrastructure: tools, sandboxes, permissions, model access. But they can't prescribe how an agent _behaves_ - how it makes decisions, orchestrates work, delegates tasks, structures reasoning. That level of opinionation is too specific to ship as a platform default. The result: every team re-invents the same patterns, badly.

Maestria is a **behavior layer** for AI coding agents. It packages proven methodology - design patterns, agent prompts, workflow rules - as reusable, installable, versioned packages. One per platform. Same patterns, adapted to each platform's native primitives. The principle is straightforward: **Agent = Model + Harness.** The model provides capability. The harness provides reliability. Most agent failures are harness failures, not model failures.

The patterns in Maestria were extracted from months of daily AI-assisted engineering work. They're scar tissue from real failures, not theoretical best practices. The maker/checker split, delegation chains, handoff contracts, iteration limits - all of these came from specific mistakes that happened more than once. These are the patterns _we stopped making_. Published under MIT so others don't have to make them either.

Maestria packages are pure plugins - no postinstall scripts, no file system side effects. Agents and rules are served directly from the npm package, not copied to your config directory. Installation is a single line in your plugin configuration. Nothing more.

## Goals

- **Multi-platform methodology.** Same design patterns, adapted to each platform's native primitives. OpenCode gets task subagents. Kimi Code gets AgentSwarm. Claude Code and Codex get hooks and extensions. The pattern is the same; the implementation adapts.

- **Discipline over capability.** Maker/checker split prevents self-approval. Iteration limits prevent infinite loops. Handoff contracts prevent dropped context. These are first-class concepts, not afterthoughts.

- **Transparency.** Every agent is a markdown file with YAML frontmatter. No TypeScript abstraction layer between you and the prompts. What you see is what the agent runs.

- **Curation-driven evolution.** Patterns are promoted only after proving useful across multiple projects and sessions. Manual curation from experience and knowledge base. No automated extraction. No session mining.

- **No vendor lock-in.** Works with any provider, any platform. MIT-licensed. Open source.

## Non-Goals

- **Not an LLM provider.** Maestria does not provide inference endpoints or model access. Model selection is your platform's configuration.

- **Not a skill bundle.** Domain-specific methodology skills (test-driven development, architecture decisions, etc.) are installed separately via the skills CLI. Maestria prescribes which to load and when, but does not include them.

- **Not auto-extracting.** All patterns are manually curated. No automated session mining, no implicit learning, no telemetry.

- **Not replacing built-in agents.** Maestria's agents are specialists for structured workflows. Each platform's general-purpose agents remain available for unstructured work.

- **Not enforcing.** Rules are guidance, not gates. The `!!!` convention signals non-negotiable rules, but enforcement happens through permissions and review, not runtime checks.

- **Not collecting data.** No telemetry, no usage tracking, no analytics, no crash reporting. Zero network calls from Maestria packages.

- **Not a single-platform tool.** Maestria is designed for multiple platforms. If it only works on one platform, it's incomplete.

## Packages

| Package                 | Platform            | Status             |
| ----------------------- | ------------------- | ------------------ |
| `@maestria/opencode`    | OpenCode            | Published (v0.3.3) |
| `@maestria/kimi-code`   | Kimi Code           | In development     |
| `@maestria/claude-code` | Claude Code & Codex | Planned            |
| `@maestria/hermes`      | Hermes              | Exploring          |
| `@maestria/pi`          | Pi                  | Shipping (v0.1.0)  |

## How This Project Evolves

Patterns are curated from experience, documented in the knowledge base, then promoted into Maestria packages when proven. The [Flue](https://flueframework.com/) meta-agent (at `apps/maestria-agent/`) assists with maintenance, analysis, and improvement proposals - but all changes flow through human review. No autonomous code changes. See **PATTERNS.md** for the catalog of design patterns that each platform package implements.
