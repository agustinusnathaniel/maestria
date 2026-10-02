# ADR-PI-001: Rules Injection via `before_agent_start`

## Status

Accepted

## Context

The maestria methodology has global rules that apply to every agent (orchestration rules, delegation table, context management) and must be present in the system prompt on every turn. Injection options: append them via `before_agent_start` (`event.systemPrompt`); ship a separate `AGENTS.md` relying on Pi auto-discovery; bundle them as an on-demand skill (`/skill:maestria-rules`); or use a per-project `SYSTEM.md` system prompt.

| Choice | Pros | Cons |
| --- | --- | --- |
| `before_agent_start` | Always present, versioned with package | Adds to every system prompt |
| AGENTS.md auto-discovery | Project-controlled, no extension | May drift from package version |
| Skill on demand | Smaller system prompt | LLM may forget to load |
| SYSTEM.md | Project-controlled | Requires per-project setup |

## Decision

We use Pi's native skill system for static behavioral content and pi-subagents registration for specialist prompts:

1. **Skill-based injection:** the orchestrator dispatcher prompt and global agent rules ship as `SKILL.md` files in `skills/`, registered via the `pi.skills` manifest field. Pi auto-discovers and injects them into every session's system prompt as `<skill>` blocks, the standard pattern in major Pi extensions.

2. **Agent registration:** the 7 specialist prompts (adventurer, architect, builder, diagnose, planner, reviewer, writer) ship as `.md` files with YAML frontmatter in `agents/`, deployed to `~/.pi/agent/agents/` at extension startup. pi-subagents discovers them via `registry.reload()` on every tool invocation, exposing them as registered agent types for `service.spawn()`.

3. **Dynamic mode prompts:** `before_agent_start` is still used, but only for workflow mode prompts (`/fein`, `/sonar`, `/blitz`); with no mode active, the handler returns void.

## Consequences

Positive:

- Standard mechanism matching Pi extension ecosystem conventions
- Auto-discovery via manifest fields (no manual file loading in code)
- Per-specialist tool isolation via the `tools` frontmatter field (builder/writer = write, all others read-only), enforcing the maker/checker split at the subagent tool level
- Clean separation of static content (skills + agents) from dynamic mode prompts
- Sync pipeline from canonical sources maintains SSOT

Negative:

- Skills and agent files ship in the npm package, increasing unpacked size
- Agent files write to `~/.pi/agent/agents/` at startup but never overwrite user customizations
- Requires pi-subagents 18.x for agent type file discovery

Divergent-claim annotation (2026-10-02, recorded under [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md) clause 7): the decision above still holds and this record stays in force, but the version line named in the last Negative entry has drifted `[verified]`. That entry reads "Requires pi-subagents 18.x for agent type file discovery"; the shipped peer is now the 21.x line, because [packages/pi/package.json](../../../packages/pi/package.json) declares `"@gotgenes/pi-subagents": "catalog:"` and [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) resolves that catalog entry to `^21.5.1`. Only the version line drifted, not the mechanism: agent type file discovery is unchanged in the resolved `21.9.0`, which still types the agent type as any string (`type SubagentType = string` in its `src/types.ts`), still loads `.md` agent files by filename from the global agents directory and the project's `.pi/agents/` directory, and still refreshes them through `registry.reload()`, so Decision item 2 holds as written. [ADR-PI-005](ADR-PI-005-pi-subagents-21-and-host-tool-filtering.md) records that move; `packages/pi/package.json` together with `pnpm-workspace.yaml` is authoritative for the current range. This annotation is placed at the claim rather than on the Status line where ADR-CORE-030 clause 2 puts one, a disclosed departure from that clause: the entry it corrects is the last Negative entry above, and the correction serves a reader better beside that entry than on the Status line. The original text is retained.

## Alternatives Considered

- **AGENTS.md auto-discovery** - tempting, but rules are package methodology, not project context.
- **Skills on demand** - unreliable for universal methodology.
- **SYSTEM.md** - per-project config, while rules should be consistent across projects.

## References

- `docs/adr/core/ADR-CORE-001-global-rules-scope.md` - what belongs in global rules
- `docs/adr/core/ADR-CORE-002-plugin-architecture.md` - opencode's rules injection pattern
- Pi extensions documentation - the `before_agent_start` event

## Injection Mechanism and Peer Dependency

Mechanism: static methodology ships as skills and specialist agent files, mode prompts through `before_agent_start`; the current wiring is in [packages/pi](../../../packages/pi/).

`@gotgenes/pi-subagents` is a peer dependency; its extension init must run separately to publish the subagent service.

## Date

2026-06-18
