# ADR-OC-000: Skill Install Flow - Orchestrator-Direct, Bundled Questions, --help as Source of Truth

## Status

Accepted

## Context

The `@maestria/opencode` plugin does not bundle skills; they are external packages installed via the skills CLI (`skills@latest`), and the orchestrator ensures subagents have needed skills before spawning them.

The initial design (commit `b00eb13`) delegated installs to `@builder` and hardcoded CLI flag documentation. Its problems:

1. **Builder delegation was over-engineered.** Running `npx --yes skills@latest add ...` is a one-line extension of the orchestrator's mediation role; the extra hop added latency and context overhead.
2. **Hardcoded flag docs were brittle.** Five flags were documented inline; names change between versions, so the prompt would drift from the CLI.
3. **Global scope was assumed nonexistent.** The design assumed `-g --global` didn't exist because `xtarter` doesn't use it, but the CLI's help confirmed it.
4. **pnpx assumption.** pnpm may not be installed; `npx` ships with Node.js.
5. **Per-skill questions created friction.** Each missing skill triggered a separate prompt (3-5 per spawn).
6. **`webfetch: ask` was tried and reverted.** Builder, adventurer, and diagnose used it; the user noted friction with no policy benefit because the opensrc-vs-webfetch rule already encodes the guidance.

## Decision

### 1. Orchestrator Runs Installs Directly

The orchestrator's bash permission allow-lists `npx --yes skills@latest *` (covering `add`, `--help`, and other subcommands) and runs installs directly after user approval via `question`, without `@builder` delegation. The orchestrator already mediates intent, so a builder hop to type one command was unnecessary.

### 2. Bundled Questions

Instead of one prompt per missing skill, the orchestrator prepares a single bundled question per spawn:

> "Specialist @X needs these skills (not in global or project):
>
> - From `vercel-labs/opensrc`: **opensrc** (general-purpose - recommend **global**)
> - From `mattpocock/skills`: **tdd** (general-purpose - recommend **global**)
>
> Install as recommended? [Y/n / specify per-skill scope]"

The user can mix scopes in one answer (e.g., "A globally, B locally"). Judgment criteria for global vs. project:

- **General-purpose** → recommend global (e.g., `opensrc`, `tdd`, `karpathy-guidelines`)
- **Project-specific** → recommend local (e.g., skills referencing this project's own tooling/ADRs)
- **When uncertain** → lean local (reversible)

### 3. `--help` Is the Source of Truth

Before any install, the orchestrator runs:

```
npx --yes skills@latest --help
```

The prompt documents no flags: names and behavior change between versions, while help output is current. This is a directive, not a suggestion.

### 4. npx over pnpx

`npx` ships with Node.js and is always available; `pnpm` might not be installed. `--yes` is npx's auto-confirm flag, separate from the CLI's own `-y`.

### 5. `-g, --global` IS a Real Flag

The initial design assumed `-g` didn't exist. The help output documents `-g, --global`, which installs to user-level scope; installs without it are project-local.

### 6. webfetch: allow for All Agents

Permissions are permissive by default; the opensrc-vs-webfetch guidance in each agent's `## Rules` section encodes the policy. Permission-level `ask` was tried for builder, adventurer, and diagnose and reverted after user feedback: it added friction without changing behavior. See ADR-OC-001 for the permission design rationale.

### Evolution From Initial Design (commit `b00eb13`)

| Dimension | Was | Became | Trigger |
| --- | --- | --- | --- |
| Install executor | `@builder` delegation | Orchestrator-direct | Over-engineering realization |
| Global flag | Assumed nonexistent | `-g` is real, `--help` confirms | User correction |
| Package manager | `pnpx` | `npx` | User: "npx ships with node" |
| Flag documentation | Hardcoded 5 flags | `--help` directive | User: "CLI is the source of truth" |
| Missing skill prompting | Per-skill question | Bundled question | Friction reduction |
| webfetch permission | `ask` for some agents | `allow` for all | User: "friction without policy benefit" |

## Consequences

- Positive: the install flow is one hop (orchestrator → user → install) instead of three.
- Positive: `--help` never drifts; flag changes are handled by the CLI, not prompt updates.
- Positive: bundled questions reduce friction to one prompt per spawn.
- Positive: `npx` works on any Node.js installation without pnpm.
- Positive: permissive `webfetch` removes friction; policy lives in the rules, not the permission system.
- Negative: the bash allow-list names the skills CLI package and entry point; a rename would break it.
- Negative: bundled questions require the orchestrator to group by source, judge scope, and format the prompt in one turn.
- Negative: no auto-install; every install requires a user `question`, even for well-known skills.

## Lessons Learned

1. **Builder delegation for installs was over-engineering.** Running one command extends the orchestrator's mediation role, and the permission allow-list makes it safe.
2. **Hardcoded CLI docs always drift; `--help` is zero-maintenance** and generalizes to any external CLI.
3. **Don't infer a tool lacks a feature because one project doesn't use it.** Running `--help` first would have caught the `-g` assumption.
4. **Permissions permissive, policy in rules.** Permission gates added friction without changing behavior.
5. **Scope judgment needs explicit criteria** ("general-purpose → global, project-specific → local, uncertain → local") to stay consistent across spawns.

## Date

2026-06-13
