# ADR-OC-000: Skill Install Flow — Orchestrator-Direct, Bundled Questions, --help as Source of Truth

## Status

Accepted

## Context

The `@maestria/opencode` plugin does not bundle skills. Skills are external packages installed via the skills CLI (`skills@latest`). The orchestrator is responsible for ensuring subagents have the skills they need before spawning them.

The initial design (commit `b00eb13`) defined a 4-part install flow that delegated installs to `@builder` and hardcoded CLI flag documentation in the prompt. This design had several problems:

1. **Builder delegation was over-engineered.** The orchestrator already mediates intent between user and specialist. Running `npx --yes skills@latest add ...` is a one-line extension of that role — adding a `@builder` hop just to type a command added latency and context overhead.
2. **Hardcoded flag documentation was brittle.** The initial prompt documented 5 CLI flags (`--skill`, `-g`, `-y`, `-l`, `-p`) inline. Flag names change between versions. The prompt would drift from the actual CLI.
3. **Global scope assumed nonexistent.** The initial design assumed `-g --global` didn't exist (because `xtarter` doesn't use it), but the skills CLI's help confirmed it is a real flag.
4. **Package manager assumption.** The initial design used `pnpx` — but pnpm may not be installed on all systems. `npx` ships with Node.js.
5. **Per-skill questions created too much friction.** Each missing skill triggered a separate user prompt. With 3-5 skills per spawn, this was disruptive.
6. **Permission-level `webfetch: ask` was tried and reverted.** Builder, adventurer, and diagnose were initially changed to `webfetch: ask`. The user pointed out this added friction with no policy benefit — the opensrc-vs-webfetch rule already encodes the guidance.

The install flow was iterated across 5 commits from `b00eb13` to `d2e0671`, converging on the current design.

## Decision

### 1. Orchestrator Runs Installs Directly

The orchestrator's bash permission allow-lists `npx --yes skills@latest *` — covering `add`, `--help`, and all other subcommands. The orchestrator runs installs directly after user approval via `question`. No `@builder` delegation.

**Rationale:** The orchestrator already mediates intent between user and specialist. Adding `@builder` to type a command is an unnecessary hop — the permission system is already set up for direct execution. The pipetask delegate → build/report pattern was over-engineering for a one-line command.

### 2. Bundled Questions

Instead of one prompt per missing skill, the orchestrator prepares a single bundled question per spawn:

> "Specialist @X needs these skills (not in global or project):
>
> - From `vercel-labs/opensrc`: **opensrc** (general-purpose — recommend **global**)
> - From `mattpocock/skills`: **tdd** (general-purpose — recommend **global**)
>
> Install as recommended? [Y/n / specify per-skill scope]"

The user can mix scopes in one answer (e.g., "A globally, B locally"). Bundling keeps the flow to one prompt per spawn, even with multiple missing skills.

Judgment criteria for global vs. project:

- **General-purpose** → recommend global (e.g., `opensrc`, `tdd`, `karpathy-guidelines`)
- **Project-specific** → recommend local (e.g., skills referencing this project's own tooling/ADRs)
- **When uncertain** → lean local (reversible)

### 3. `--help` Is the Source of Truth

Before any install, the orchestrator runs:

```
npx --yes skills@latest --help
```

This is not a suggestion — it is a directive. The prompt does not document the CLI's flag set. Flag names and behavior change between versions; the CLI's help output is always current.

### 4. npx over pnpx

`npx` ships with Node.js and is always available. `pnpm` might not be installed. `--yes` is npx's auto-confirm flag (separate from the skills CLI's own `-y`).

### 5. `-g, --global` IS a Real Flag

The initial design assumed `-g` didn't exist. The `--help` output confirms: `-g, --global` is documented. It installs to user-level scope (visible across all projects). Without `-g`, the install is project-local.

### 6. webfetch: allow for All Agents

Permissions are permissive by default. The opensrc-vs-webfetch guidance in each agent's `## Rules` section encodes the policy. Permission-level `ask` was tried for builder, adventurer, and diagnose — it was reverted after user feedback because it added friction without changing behavior. (See ADR-OC-001 for the full permission design rationale.)

### Evolution From Initial Design (commit `b00eb13`)

| Dimension               | Was                   | Became                          | Trigger                                 |
| ----------------------- | --------------------- | ------------------------------- | --------------------------------------- |
| Install executor        | `@builder` delegation | Orchestrator-direct             | Over-engineering realization            |
| Global flag             | Assumed nonexistent   | `-g` is real, `--help` confirms | User correction                         |
| Package manager         | `pnpx`                | `npx`                           | User: "npx ships with node"             |
| Flag documentation      | Hardcoded 5 flags     | `--help` directive              | User: "CLI is the source of truth"      |
| Missing skill prompting | Per-skill question    | Bundled question                | Friction reduction                      |
| webfetch permission     | `ask` for some agents | `allow` for all                 | User: "friction without policy benefit" |

## Consequences

- Positive: Install flow is one hop (orchestrator → user → install) instead of three (orchestrator → builder → user → install → builder reports)
- Positive: `--help` directive never drifts — flag changes are handled by the CLI, not by prompt updates
- Positive: Bundled questions reduce user friction — one prompt per spawn regardless of how many skills are missing
- Positive: `npx` ensures the flow works on any Node.js installation without requiring pnpm
- Positive: Permissive `webfetch` removes friction; policy is in the rules, not in the permission system
- Negative: Orchestrator's bash permission must allow-list `npx --yes skills@latest *` — any change to the skills CLI's package name or entry point would break the allow-list
- Negative: Bundled question format is complex — the orchestrator must group by source, judge global vs. project, and format the prompt in one turn
- Negative: No auto-install — every install requires a user `question` prompt, even for well-known skills

## Lessons Learned

1. **Builder delegation for installs was over-engineering.** The initial design assumed the orchestrator should never run commands. But the orchestrator already mediates intent — running `npx ...` is a one-line extension of that role, not an implementation task. The permission allow-list makes it safe.

2. **Hardcoded CLI documentation always drifts.** The first attempt documented 5 flags inline. Even if accurate at write time, it would rot as the CLI evolved. Running `--help` is zero-maintenance and more reliable.

3. **"CLI is the source of truth" was a user-driven optimization.** The user pointed out that documenting flags in the prompt was fragile. This is a generalizable lesson: for any external CLI tool, `--help` is better than hardcoded docs.

4. **Don't assume a tool doesn't exist because one project doesn't use it.** The `-g` flag was assumed nonexistent because `xtarter` doesn't use global installs. The `--help` output would have caught this earlier if we'd run it first.

5. **Permissions should be permissive; rules should encode policy.** The `webfetch: ask` experiment confirmed that permission-level gates don't change behavior — they just add friction. The opensrc-vs-webfetch policy belongs in `## Rules`, not in the frontmatter.

6. **Scope judgment (global vs. local) needs clear criteria.** The first version had none. Adding "general-purpose → global, project-specific → local, uncertain → local" made the decision consistent across spawns.

## Date

2026-06-13
