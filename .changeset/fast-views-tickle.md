---
"@maestria/agent-plugins": patch
"maestria": patch
---

Install `@maestria/agent-plugins` straight from the package root, following the PostHog and Cursor pstack layout: the host manifests sit at the root and select shared `agents/`, `commands/`, `rules/`, and `skills/` folders, with no nested installation bundle or duplicate component tree. Each specialist profile and workflow command carries its complete role, routing, and global policy, composed from canonical core directives at sync, so no host depends on preloading role or policy skills. Codex profiles are generated TOMLs with complete instructions. One root `AGENTS.md` carries the global policy and routing for Devin, Kimi Code (through `systemPromptPath`), Codex (installed by the CLI), and Hermes, with a short note per host; only OMP and Cursor keep their own rule files because their formats differ.

The documentation now has one Installation page and one Usage page with a section per host, including separate CLI and desktop setup for Codex and Claude Code. The former per-host page URLs redirect to those sections.

Codex profile updates keep model settings when a prompt contains TOML-like text, and sync dry runs that hit a processing error now fail preflight before anything is written.
