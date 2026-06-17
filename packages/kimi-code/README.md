# @maestria/kimi-code

A declarative, manifest-based Kimi Code plugin that ships 8 specialized
skills (orchestrator + 7 specialists) for engineering workflows with
swarm-aware orchestration.

## Install

See [INSTALL.md](./INSTALL.md) for the full checklist. Quick start:

```
/plugins install https://github.com/agustinusnathaniel/maestria
mkdir -p ~/.kimi-code && cp packages/kimi-code/rules/AGENTS.md ~/.kimi-code/AGENTS.md
```

## The 8 Skills at a Glance

| Skill          | Subagent  | Purpose                                                              |
| -------------- | --------- | -------------------------------------------------------------------- |
| `orchestrator` | main      | Auto-loaded at session start. Methodology, delegation, swarm.        |
| `builder`      | `coder`   | Focused implementation — atomic tasks, write code, run tests.        |
| `adventurer`   | `explore` | Codebase reconnaissance — read-only exploration, structured reports. |
| `architect`    | `coder`   | Architecture decisions, trade-offs, ADRs.                            |
| `planner`      | `plan`    | Multi-phase implementation plans, success criteria, rollback.        |
| `reviewer`     | `coder`   | Code review with quality gates — no editing, structured feedback.    |
| `writer`       | `coder`   | Documentation — READMEs, API docs, changelogs, ADR transcription.    |
| `diagnose`     | `coder`   | Root cause analysis — 6-step methodology, blast-radius audit.        |

The orchestrator's `whenToUse` field teaches the model when to dispatch
each persona. The 7 specialists are loaded on demand via the
`Skill` tool.

## Design Philosophy

This plugin is built on the **Harness Engineering** principle:
`Agent = Model + Harness`. The harness is what turns a raw LLM into a
reliable coding agent — the model is just one component.

The 6 harness components map directly to plugin features:

| Component         | Plugin Mapping                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| **Instructions**  | `rules/AGENTS.md` placed at `~/.kimi-code/AGENTS.md` (auto-loaded)           |
| **Tools**         | Skill prescription per specialist; `AgentSwarm` for parallel fan-out         |
| **Sandboxes**     | Subagent profile tool lists (`coder`/`explore`/`plan`); `permission.rules`   |
| **Orchestration** | `sessionStart.skill` (orchestrator auto-loads); `Agent` / `AgentSwarm` tools |
| **Guardrails**    | `!!!` rule markers in every SKILL.md; iteration limits; persona constraints  |
| **Observability** | `PreCompact` / `PostCompact` hooks (observation-only); structured handoffs   |

Most agent failures are configuration failures, not model failures. The
plugin's skills are designed with this principle — precise rules,
explicit boundaries, and clear delegation chains over raw capability.

### How It Works

1. **Plugin loads** — Kimi Code parses `kimi.plugin.json` from the
   installed location.
2. **Skills discovered** — `skills/` is walked; each `SKILL.md` is
   parsed and registered.
3. **Session start** — `sessionStart.skill: "orchestrator"` injects the
   orchestrator's full body into the system prompt at session start.
4. **Rules loaded** — `~/.kimi-code/AGENTS.md` (which the user copies
   from `rules/AGENTS.md`) is auto-loaded by Kimi Code's session-start
   context preparer.
5. **Specialists dispatched** — the orchestrator loads specialist
   skills via the `Skill` tool and inlines them into `Agent` /
   `AgentSwarm` prompts.
6. **Swarm fan-out** — for ≥3 uniform items, `AgentSwarm` runs the
   same persona against a list of items, returning a single
   `<agent_swarm_result>` envelope.

### Declarative-Only

Unlike OpenCode's plugin SDK, Kimi Code's plugin system is
**declarative** — no TypeScript, no SDK hooks, no build step. The
plugin is just `kimi.plugin.json` + `skills/` + `rules/`. This means:

- **No build step** — edit, commit, install.
- **No programmatic hooks** — the orchestrator skill carries the
  methodology, and Kimi Code's `[[hooks]]` blocks (user-managed) cover
  the rest.
- **No custom subagent identity** — Kimi Code hardcodes
  `coder`/`explore`/`plan`. The 7 specialist identities are encoded
  as persona content in prompt templates.

See [ADR-004](../adr/ADR-004-kimi-code-architecture.md) for the full
design rationale.

## Updating

```
/plugins install https://github.com/agustinusnathaniel/maestria
```

Updates follow the latest release by default. Pin via tag or SHA for
production work (see [INSTALL.md](./INSTALL.md)).

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) at the monorepo root.

## License

MIT

## Related

- [`@maestria/opencode`](../opencode/README.md) — the OpenCode variant
  of this plugin (TypeScript SDK, programmatic hooks).
- [ADR-004](../adr/ADR-004-kimi-code-architecture.md) — the architecture
  decision record for the Kimi Code plugin.
