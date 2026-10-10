# maestria Vision

I told the short version of this story on the [About page](https://maestria.sznm.dev/about/). This file is the longer version, grounded in how I actually build.

## Motivation

AI coding agents provide tools, sandboxes, permissions, and model access. Teams still need to decide how agents plan work, delegate tasks, and review results.

maestria is a **behavior layer** for these agents. It packages design patterns, agent prompts, and workflow rules as reusable, versioned plugins adapted to each platform. The guiding principle is **Agent = Model + Harness**: the model provides capability; the harness shapes how reliably it is used.

The patterns come from months of daily AI-assisted engineering. Independent review, delegation chains, handoff contracts, and iteration limits address recurring failures from that work. They are published under MIT so other teams can reuse them.

maestria packages do not use automatic postinstall scripts. Direct plugin installers read the package's agents, skills, and rules, while the `maestria` CLI may stage packages or update host-owned files when you explicitly ask it to. The consolidated plugin shares portable skills and selects native resources through host manifests. Check each platform guide for the host-specific installation and update behavior.

## Goals

- **Multi-platform methodology.** Same design patterns, adapted to each platform's native primitives. OpenCode gets task subagents. Kimi Code gets AgentSwarm. Claude Code gets declarative agents, skills, and commands. Codex gets skills plus CLI-managed native agents and instructions.

- **Discipline over capability.** Maker/checker split prevents self-approval. Iteration limits prevent infinite loops. Handoff contracts prevent dropped context.

- **Transparency.** Every agent is a markdown file with YAML frontmatter. No abstraction layer between you and the prompts. One canonical source, projected per platform and checked by sync.

- **Curation-driven evolution.** Patterns are promoted only after proving useful across multiple projects and sessions. Manual curation from experience and knowledge base. No automated extraction. No session mining.

- **No model-provider lock-in.** maestria does not provide inference or require one model provider. Each coding-agent platform still needs a compatible native integration or Agent Plugins v1 support. MIT-licensed. Open source.

## Non-Goals

- **Not an LLM provider.** maestria does not provide inference endpoints or model access. Model selection is your platform's configuration.

- **Focused skill bundle.** Domain-specific methodology skills (test-driven development, architecture decisions, etc.) are installed separately via the skills CLI. maestria prescribes which to load and when, but does not include them.

- **Not auto-extracting.** All patterns are manually curated. No automated session mining, no implicit learning, no telemetry.

- **Not replacing built-in agents.** maestria's agents are specialists for structured workflows. Each platform's general-purpose agents remain available for unstructured work.

- **Not enforcing.** Rules are guidance, not gates. The `!!!` convention signals non-negotiable rules, but enforcement happens through permissions and review, not runtime checks.

- **Not collecting data.** Runtime plugins make no background telemetry, analytics, or crash-reporting calls. The CLI may contact package registries or host CLIs only when you request status, installation, updates, or version checks.

- **Not a single-platform tool.** maestria is designed for multiple platforms. If it only works on one platform, it's incomplete.

## Packages

| Package | Platform |
| --- | --- |
| `@maestria/opencode` | OpenCode |
| `@maestria/agent-plugins` | Codex, Claude Code, Cursor, Kimi Code, Devin, ZCode, Hermes, OMP, Agent Plugins |
| `@maestria/pi` | Pi |

Canonical agent directives live in the private `@maestria/core` package (`packages/core/agent-directives/`) and are projected into the platform packages above by the sync pipeline. `packages/shared/*` holds private host-neutral utilities. Neither is published.

## How This Project Evolves

Patterns are curated from experience, documented in the knowledge base, then promoted into maestria packages when proven. All changes flow through human review. No autonomous code changes. See [PATTERNS.md](PATTERNS.md) for the catalog of design patterns that each platform package implements.
