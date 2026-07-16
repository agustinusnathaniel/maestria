# ADR-HM-000: Plugin Over Skills-Only Distribution for @maestria/hermes

## Status

Accepted (2026-07-16)

## Context

The `@maestria/hermes` package delivers the Maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes Agent platform. Hermes supports two extension mechanisms:

1. **Skills** — Markdown files loaded into context. They provide methodology guidance, rules, and prompts. Passive advice that the agent can follow or ignore.

2. **Plugins** — Python packages with hooks, middleware, tools, and commands registered via `hermes_agent.plugins` entry points. Active enforcement that runs in the agent lifecycle.

The question: could we ship the methodology as skills-only (zero Python code, zero PyPI publishing), or does it require a full plugin?

## Decision

**Ship as a full Hermes plugin (Python package on PyPI), not skills-only.**

The methodology layer has two distinct parts:

| Layer | What it is | Can be a skill? |
| --- | --- | --- |
| **Methodology guidance** | Specialist prompts, rules, routing advice | ✅ Yes — these are the 9 SKILL.md files |
| **Enforcement layer** | Tool gating, mode switching, backend detection, subagent tracking, OpenCode plugin verification | ❌ No — requires hooks, middleware, tools, commands |

Skills alone deliver ~60-70% of the value for a disciplined agent who manually follows the patterns. But the remaining 30-40% — the automated enforcement that makes the methodology reliable without depending on agent discipline — requires plugin-level APIs.

### What skills cannot do

| Capability | Hermes API required | Why it matters |
| --- | --- | --- |
| Block write tools in sonar mode | `pre_tool_call` hook | Prevents accidental edits during research |
| Inject mode/role context | `pre_llm_call` hook | Avoids repetitive prompting |
| `/fein` `/sonar` `/blitz` commands | `register_command()` | Instant mode switching without manual prompt edits |
| Persist mode across sessions | Python state management | Mode survives `/resume` and session restarts |
| Detect Mnemosyne/kanban at startup | Python filesystem + tool registry probes | Graceful fallback instead of silent failure |
| Verify `@maestria/opencode` plugin | `subprocess` + filesystem checks | Prevents silent methodology drift in delegated tasks |
| Track subagent pipeline | `subagent_start/stop` hooks | Observability into specialist lifecycle |

This is not a theoretical distinction — during development we found and fixed **6 bugs** that only existed because we had plugin-level access to the Hermes API (wrong kwarg names from `delegate_tool.py`, missing `Path`-vs-string type mismatch in `register_skill`, non-existent `PluginContext` methods in detection code). A skills-only approach would have encountered the same methodology mismatches with no way to detect or fix them.

### Distribution consequences

A plugin requires PyPI publishing. This adds:

- A PyPI account and API token
- CI/CD publishing step (`.github/workflows/release.yml`, lines 73-82)
- Version management via `setuptools-scm`

The alternative — users cloning the repo and loading skills manually — is documented as an option but is not the primary distribution path.

## Consequences

### Positive

- **Reliable enforcement** — methodology gates cannot be skipped by an agent that "forgets" to follow instructions
- **Fail-fast detection** — missing backends (Mnemosyne, kanban, `@maestria/opencode`) are reported at startup, not discovered mid-task
- **First-class integration** — slash commands, mode persistence, and lifecycle hooks feel native to Hermes rather than bolted on
- **Discoverability** — `pip install maestria-hermes` with an entry point is the standard Hermes plugin distribution model

### Negative

- **PyPI dependency** — requires an account, token, and CI publishing step that skills-only avoids
- **Python knowledge required** — contributing to the enforcement layer requires Python, not just Markdown
- **Version coupling** — the plugin must stay compatible with Hermes Agent's hook signatures (validated against source at `github.com/nousresearch/hermes-agent`)
- **Larger surface area** — more code to maintain than 9 Markdown files

### Mitigations

- Skills are still shipped as part of the plugin (under `src/maestria_hermes/skills/`) — users get both layers in one package
- The plugin's Python code is minimal (~900 lines total across 10 files) — a thin adapter that dispatches to Hermes-native subsystems
- All hook and middleware signatures were validated against actual Hermes source code before merge

## Related Decisions

- ADR-CORE-002 (plugin architecture — established the plugin pattern for `@maestria/opencode`)
- ADR-CORE-005 (shared agent directives core sync — the SKILL.md files are synced from canonical core sources)
- ADR-OC-001 (tool permission design — influenced the `PermissionRole` concept adapted for Hermes)
