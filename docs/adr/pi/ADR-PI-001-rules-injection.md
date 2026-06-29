# ADR-PI-001: Rules Injection via `before_agent_start`

## Status

Accepted

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

Choose `before_agent_start` event handler, with the rules content bundled into the extension as a string constant.

The rules content lives in `rules/AGENTS.md` (source) and `dist/rules-content.js` (generated, embedded as `MAESTRIA_RULES_CONTENT` string). The extension's `installRulesInjection` function subscribes to `before_agent_start` and appends:

```
\n\n## Maestria Global Rules\n\n{content}
```

to the system prompt on every turn.

This is the closest analog to OpenCode's `input.instructions` injection (per ADR-CORE-002) and to the `system.transform` hook that the opencode README references.

The rules content includes: Orchestration (don't assume, read docs first, use opensrc), Delegation (7-specialist table), Context management (progressive disclosure, checkpointing), Webfetch may hang, CLI references, Local files.

## Consequences

- Positive: Rules always present. No risk of LLM forgetting to load a skill.
- Positive: Rules are versioned with the package.
- Positive: Injection is unconditional - works in any project.
- Positive: Rules content is build-time embed (no runtime FS read).
- Negative: Adds ~3KB to every system prompt.
- Negative: Cannot be turned off without removing the extension.
- Negative: If rules content is wrong, it's wrong in every session.

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
