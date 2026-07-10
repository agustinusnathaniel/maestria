# ADR-PI-001: Rules Injection via `before_agent_start`

## Status

Superseded

## Context

The maestria methodology has global rules that apply to every agent (orchestration rules, delegation table, context management). These rules must be present in the system prompt on every turn.

The choices for injection:

1. **`before_agent_start` event handler** - append rules to `event.systemPrompt` on every agent start.
2. **Ship a separate `AGENTS.md` and rely on Pi's auto-discovery** - Pi auto-discovers `AGENTS.md` in the project root and ancestor directories.
3. **Bundle the rules as a skill (`/skill:maestria-rules`)** - load on demand.
4. **Modify the parent system prompt via the agent's `SYSTEM.md`** - Pi supports `--system-prompt` for custom system prompts.

| Choice | Pros | Cons |
| --- | --- | --- |
| `before_agent_start` | Always present, versioned with package | Adds 3KB+ to every system prompt |
| AGENTS.md auto-discovery | Project-controlled, no extension | May drift from package version |
| Skill on demand | Smaller system prompt | LLM may forget to load |
| SYSTEM.md | Project-controlled | Requires per-project setup |

## Decision

We will use Pi's native skill system for static behavioral content and pi-subagents agent registration for specialist prompts:

1. **Skill-based injection:** The orchestrator dispatcher prompt and global agent rules ship as `SKILL.md` files in `skills/`, registered via the `pi.skills` manifest field. Pi's resource loader auto-discovers them and injects them into every session's system prompt as `<skill>` blocks. This is the standard pattern used by all major Pi extensions (pi-web-access, pi-messenger, pi-intercom, pi-powerline-footer).

2. **Pi-subagents agent registration:** The 7 specialist prompts (adventurer, architect, builder, diagnose, planner, reviewer, writer) ship as `.md` files with YAML frontmatter in `agents/`, deployed to `~/.pi/agent/agents/` at extension startup. pi-subagents discovers them via `registry.reload()` on every tool invocation, making them available as registered agent types for `service.spawn()`.

3. **Dynamic mode prompts:** The `before_agent_start` event is still used, but only for workflow mode prompt injection (`/fein`, `/sonar`, `/blitz`). When no mode is active, the handler returns void (no modification).

## Consequences

Positive:

- Standard mechanism matching Pi extension ecosystem conventions
- Auto-discovery via manifest fields (no manual file loading in code)
- Tool isolation per specialist via `tools` frontmatter field (builder/writer = write access, all others read-only), enforcing maker/checker split at the subagent tool level
- Clean separation of static content (skills + agents) from dynamic content (mode prompts in before_agent_start)
- Sync pipeline from canonical sources maintains SSOT

Negative:

- Skills and agent files must be published in the npm package (increases unpacked size by ~80KB)
- Agent files write to user's `~/.pi/agent/agents/` directory at startup (but never overwrite user customizations)
- Requires pi-subagents 17.x for agent type file discovery

## Alternatives Considered

- **AGENTS.md auto-discovery** - tempting but rules are package methodology, not project context.
- **Skills on demand** - unreliable for universal methodology.
- **SYSTEM.md** - per-project config, rules should be consistent across projects.

## References

- `docs/adr/core/ADR-CORE-001-global-rules-scope.md` - what belongs in global rules
- `docs/adr/core/ADR-CORE-002-plugin-architecture.md` - opencode's rules injection pattern
- Pi `before_agent_start` event - extensions.md:494-528

## Implementation Notes (Post-Implementation)

### ✅ Rules Content Embedded as String Constant

The rules content is embedded as a string constant in `dist/rules-content.js` during build. The `installRulesInjection` function subscribes to `before_agent_start` and appends to `event.systemPrompt` on every turn.

### ✅ Injected on Every Agent Start

Rules are injected on every agent start, including subagents. No agent runs without the maestria global rules present.

### ✅ Overhead Confirmed Acceptable

Total overhead is ~3KB per system prompt, confirmed within acceptable range during testing.

### ⚠️ No Per-Project Override Mechanism

No per-project override mechanism exists - users must uninstall the extension to disable rules. This matches the ADR's original design, but is worth flagging for future work if the methodology evolves to support opt-out per project.

## Date

2026-06-18
