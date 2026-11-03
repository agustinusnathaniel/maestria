## Devin Integration

Devin loads this file, the package's root `AGENTS.md`, always-on for policy and routing, and includes only its first 16 KiB, so this file holds the always-on core and this note. Devin discovers the root `agents/*.md` as plugin subagents in local CLI and Desktop sessions, not cloud sessions; preserve maker/checker separation with the subagent controls the host exposes. The reviewer profile's `allowed-tools: [read, grep, glob]` limits it to read tools, so it cannot edit files or run shell commands.

Devin has no plugin commands component, so the workflow modes ship as the `fein`, `sonar`, and `blitz` skills: run `/maestria:<mode> <task>` in the CLI or Desktop, or `@skills:<mode> <task>` in the web app. When a message starts with a mode keyword, load the matching skill before acting.

See [Devin plugin file format](https://docs.devin.ai/cli/extensibility/plugins/overview).
