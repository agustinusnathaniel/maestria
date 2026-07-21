# ADR-HM-000: Plugin Over Skills-Only Distribution for @maestria/hermes

## Status

Accepted (2026-07-16)

## Context

The `@maestria/hermes` package delivers the Maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes Agent platform. Hermes supports two extension mechanisms:

1. **Skills** — Markdown files loaded into context. They provide methodology guidance, rules, and prompts. Passive advice that the agent can follow or ignore.

2. **Plugins** — Python packages with hooks, middleware, tools, and commands registered via `hermes_agent.plugins` entry points. Active enforcement that runs in the agent lifecycle.

The question: could we ship the methodology as skills-only (zero Python code, zero PyPI publishing), or does it require a full plugin?

## Decision

**Ship as a full Hermes plugin (git-based distribution), not skills-only.**

The methodology layer has two distinct parts:

| Layer | What it is | Can be a skill? | | --- | --- | --- | --- | | **Methodology guidance** | Specialist prompts, rules, routing advice | ✅ Yes — these are the 9 SKILL.md files | | | **Enforcement layer** | Tool gating, mode switching, subagent tracking, OpenCode CLI routing | ❌ No — requires hooks, middleware, tools, commands |

Skills alone deliver ~60-70% of the value for a disciplined agent who manually follows the patterns. But the remaining 30-40% — the automated enforcement that makes the methodology reliable without depending on agent discipline — requires plugin-level APIs.

### What skills cannot do

| Capability | Hermes API required | Why it matters |
| --- | --- | --- |
| Block write tools in sonar mode | `pre_tool_call` hook | Prevents accidental edits during research |
| Inject mode/role context | `pre_llm_call` hook | Avoids repetitive prompting |
| `/fein` `/sonar` `/blitz` commands | `register_command()` | Instant mode switching without manual prompt edits |
| Persist mode across sessions | Python state management | Mode survives `/resume` and session restarts |
| Verify `@maestria/opencode` plugin | `subprocess` + filesystem checks | Prevents silent methodology drift in delegated tasks |
| Track subagent pipeline | `subagent_start/stop` hooks | Observability into specialist lifecycle |

> **Note (2026-07-17):** The "Detect Mnemosyne/kanban at startup" row was removed in this revision. The plugin is now **memory-engine agnostic** — it never probes for, reads from, or writes to any memory provider. Memory is a platform concern (Hermes has 8 built-in providers), not a plugin concern. See Principle #2 in `docs/hermes-maestria-plugin.md` and the memory agnosticism audit that led to this change.

> **Note (2026-07-17):** The "Verify `@maestria/opencode` plugin" row was removed in this revision (and the corresponding `_detect_backends()` startup probe and `_check_maestria_plugin()` function were deleted). The plugin now has no startup probes for any external tool. The `opencode_route` tool is a simple CLI delegator — it calls `opencode run <goal>` and fails clearly if the CLI is missing. Responsibility for the OpenCode plugin's methodology consistency is owned by the OpenCode platform, not by the Hermes plugin.

This is not a theoretical distinction — during development we found and fixed **6 bugs** that only existed because we had plugin-level access to the Hermes API (wrong kwarg names from `delegate_tool.py`, missing `Path`-vs-string type mismatch in `register_skill`, non-existent `PluginContext` methods in detection code). A skills-only approach would have encountered the same methodology mismatches with no way to detect or fix them.

### Distribution consequences

The plugin uses **git-based distribution** via `hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable`. No PyPI publishing is involved.

The alternative — users cloning the repo and loading skills manually — is documented as an option but is not the primary distribution path.

## Consequences

### Positive

- **Reliable enforcement** — methodology gates cannot be skipped by an agent that "forgets" to follow instructions
- **Clean responsibility boundary** — the plugin owns methodology enforcement (modes, roles, gates) without probing or verifying external tools. The `opencode_route` tool is a simple CLI delegator — if OpenCode CLI is not installed, it reports the error clearly. It does not check for `@maestria/opencode` or any other npm package.
- **First-class integration** — slash commands, mode persistence, and lifecycle hooks feel native to Hermes rather than bolted on
- **Discoverability** — `hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable` is the standard Hermes plugin install flow

### Negative

- Python knowledge required — contributing to the enforcement layer requires Python, not just Markdown
- Version coupling — the plugin must stay compatible with Hermes Agent's hook signatures (validated against source at `github.com/nousresearch/hermes-agent`)
- Larger surface area — more code to maintain than 9 Markdown files

### Mitigations

- Skills are still shipped as part of the plugin (under `src/maestria_hermes/skills/`) — users get both layers in one package
- The plugin's Python code is minimal (~650 lines across 12 files — see the v0.1 memory agnosticism cleanup) — a thin adapter that dispatches to Hermes-native subsystems
- All hook and middleware signatures were validated against actual Hermes source code before merge

## Related Decisions

- ADR-CORE-002 (plugin architecture — established the plugin pattern for `@maestria/opencode`)
- ADR-CORE-005 (shared agent directives core sync — the SKILL.md files are synced from canonical core sources)
- ADR-OC-001 (tool permission design — influenced the `PermissionRole` concept adapted for Hermes)
