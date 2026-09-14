# ADR-HM-000: Plugin Over Skills-Only Distribution for @maestria/hermes

## Status

Accepted (2026-07-16)

## Context

`@maestria/hermes` delivers the Maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes Agent platform, which supports two extension mechanisms:

1. **Skills** - Markdown loaded into context: guidance, rules, and prompts. Passive advice the agent can follow or ignore.
2. **Plugins** - Python packages with hooks, middleware, tools, and commands registered via `hermes_agent.plugins` entry points: active enforcement in the agent lifecycle.

Could the methodology ship as skills-only (no Python, no PyPI publishing), or does it require a full plugin?

## Decision

**Ship as a full Hermes plugin with git-based distribution, not skills-only.**

The methodology layer has two parts:

- **Methodology guidance** - specialist prompts, rules, and routing advice. These are the SKILL.md files.
- **Enforcement layer** - tool gating, mode switching, subagent tracking, and OpenCode CLI routing. It cannot be a skill: it requires hooks, middleware, tools, and commands.

Skills alone deliver most of the value for a disciplined agent that follows the patterns manually; the enforcement that makes the methodology reliable without depending on agent discipline requires plugin-level APIs.

### What skills cannot do

- **Block write tools in sonar mode** (`pre_tool_call` hook) - prevents accidental edits during research
- **Inject mode/role context** (`pre_llm_call` hook) - avoids repetitive prompting
- **`/fein` `/sonar` `/blitz` commands** (`register_command()`) - instant mode switching
- **Persist mode across sessions** (Python state) - survives `/resume` and restarts
- **Track the subagent pipeline** (`subagent_start/stop` hooks) - specialist lifecycle observability

> **Note (2026-07-17).** The startup memory-provider probe was removed: the plugin is now **memory-engine agnostic**. It never probes, reads, or writes any memory provider; memory is a platform concern, not a plugin concern. See Principle #2 in `docs/hermes-maestria-plugin.md`.

> **Note (2026-07-17).** The `@maestria/opencode` verification row and its startup probes were removed: the plugin has no startup probes for external tools. `opencode_route` is a simple CLI delegator that calls `opencode run <goal>` and fails clearly if the CLI is missing; OpenCode plugin consistency is the OpenCode platform's responsibility.

The distinction is practical: development surfaced and fixed bugs that existed only because the plugin had direct access to the Hermes API; skills-only would have hit the same methodology mismatches with no way to detect or fix them.

### Distribution consequences

The plugin uses **git-based distribution** via `hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable`; no PyPI publishing. Manual cloning and skill loading remains an alternative, not the primary path.

## Consequences

### Positive

- **Reliable enforcement** - methodology gates cannot be skipped by an agent that "forgets" instructions
- **Clean responsibility boundary** - the plugin owns methodology enforcement without probing external tools; `opencode_route` reports a missing OpenCode CLI clearly
- **First-class integration** - slash commands, mode persistence, and lifecycle hooks feel native to Hermes
- **Discoverability** - installation follows the standard Hermes plugin flow

### Negative

- Python knowledge required - the enforcement layer needs Python, not just Markdown
- Version coupling - the plugin must stay compatible with Hermes Agent hook signatures
- Larger surface area - more code to maintain than the Markdown skills alone

### Mitigations

- Skills still ship inside the plugin, so users get both layers in one package
- The Python code is a minimal thin adapter over Hermes-native subsystems
- Hook and middleware signatures were validated against Hermes source before implementation

## Related Decisions

- ADR-CORE-002 (plugin architecture - established the plugin pattern for `@maestria/opencode`)
- ADR-CORE-005 (shared agent directives core sync - the SKILL.md files are synced from canonical core sources)
- ADR-OC-001 (tool permission design - influenced the `PermissionRole` concept adapted for Hermes)
