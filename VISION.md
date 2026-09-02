# Maestria Vision

## Motivation

AI coding agents - OpenCode, Claude Code, Codex, Kimi Code - provide excellent infrastructure: tools, sandboxes, permissions, model access. But they can't prescribe how an agent _behaves_ - how it makes decisions, orchestrates work, delegates tasks, structures reasoning. That level of opinionation is too specific to ship as a platform default. The result: every team re-invents the same patterns, badly.

Maestria is a **behavior layer** for AI coding agents. It packages proven methodology - design patterns, agent prompts, workflow rules - as reusable, installable, versioned packages. One per platform. Same patterns, adapted to each platform's native primitives. The principle is straightforward: **Agent = Model + Harness.** The model provides capability. The harness provides reliability. Most agent failures are harness failures, not model failures.

The patterns in Maestria were extracted from months of daily AI-assisted engineering work. They're scar tissue from real failures, not theoretical best practices. The maker/checker split, delegation chains, handoff contracts, iteration limits - all of these came from specific mistakes that happened more than once. These are the patterns _we stopped making_. Published under MIT so others don't have to make them either.

Maestria packages do not use automatic postinstall scripts. Direct plugin installers read the package's agents, skills, and rules, while the `maestria` CLI may stage packages or update host-owned files when you explicitly ask it to. The portable Agent Plugin package contains only its manifest and skills. Check each platform guide for the host-specific installation and update behavior.

## Goals

- **Multi-platform methodology.** Same design patterns, adapted to each platform's native primitives. OpenCode gets task subagents. Kimi Code gets AgentSwarm. Claude Code gets declarative agents, skills, and commands. Codex gets skills plus CLI-managed native agents and instructions. The pattern is the same; the implementation adapts.

- **Discipline over capability.** Maker/checker split prevents self-approval. Iteration limits prevent infinite loops. Handoff contracts prevent dropped context. These are first-class concepts, not afterthoughts.

- **Transparency.** Every agent is a markdown file with YAML frontmatter. No TypeScript abstraction layer between you and the prompts. What you see is what the agent runs.

- **Curation-driven evolution.** Patterns are promoted only after proving useful across multiple projects and sessions. Manual curation from experience and knowledge base. No automated extraction. No session mining.

- **No model-provider lock-in.** Maestria does not provide inference or require one model provider. Each coding-agent platform still needs a compatible native integration or Agent Plugins v1 support. MIT-licensed. Open source.

## Non-Goals

- **Not an LLM provider.** Maestria does not provide inference endpoints or model access. Model selection is your platform's configuration.

- **Not a skill bundle.** Domain-specific methodology skills (test-driven development, architecture decisions, etc.) are installed separately via the skills CLI. Maestria prescribes which to load and when, but does not include them.

- **Not auto-extracting.** All patterns are manually curated. No automated session mining, no implicit learning, no telemetry.

- **Not replacing built-in agents.** Maestria's agents are specialists for structured workflows. Each platform's general-purpose agents remain available for unstructured work.

- **Not enforcing.** Rules are guidance, not gates. The `!!!` convention signals non-negotiable rules, but enforcement happens through permissions and review, not runtime checks.

- **Not collecting data.** Runtime plugins make no background telemetry, analytics, or crash-reporting calls. The CLI may contact package registries or host CLIs only when you request status, installation, updates, or version checks.

- **Not a single-platform tool.** Maestria is designed for multiple platforms. If it only works on one platform, it's incomplete.

## Packages

| Package                  | Platform         |
| ------------------------ | ---------------- |
| `@maestria/opencode`     | OpenCode         |
| `@maestria/kimi-code`    | Kimi Code        |
| `@maestria/cursor`       | Cursor IDE & CLI |
| `@maestria/omp`          | Oh My Pi         |
| `@maestria/claude-code`  | Claude Code      |
| `@maestria/codex`        | Codex CLI        |
| `@maestria/hermes`       | Hermes           |
| `@maestria/pi`           | Pi               |
| `@maestria/prime-agent`  | Prime Agent      |
| `@maestria/agent-plugin` | Agent Plugins v1 |

## How This Project Evolves

Patterns are curated from experience, documented in the knowledge base, then promoted into Maestria packages when proven. All changes flow through human review. No autonomous code changes. See **PATTERNS.md** for the catalog of design patterns that each platform package implements.
