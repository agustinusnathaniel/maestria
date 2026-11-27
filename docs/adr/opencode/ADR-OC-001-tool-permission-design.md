# ADR-OC-001: OpenCode Tool Permissions: Coarse Gates, Policy in Directives

## Status

Accepted (2026-06-13). Condensed 2026-11-27: the seven-agent audit it recorded predates the main loop ([CORE-035](../core/ADR-CORE-035-main-loop-with-one-reviewer.md)), which replaced the orchestrator lockdown described below. [The agent generation input](../../../packages/opencode/generation/agents.ts) owns the current permission maps.

## Context

Each OpenCode agent's frontmatter sets tool permissions (`read`, `edit`, `bash`, `webfetch`, `task`, and so on). The first permissions were set per agent without an audit, and the audit found entries for tools that no longer existed, missing code-intelligence access, and `ask` gates that added friction without changing any decision.

## Decision

**Permissions are coarse gates; directives encode policy.** Permissions decide whether an agent may use the web, edit files, run commands, or dispatch subagents. Fine-grained choices (which source to read, when to test, when to stop) belong in the directives. Frontmatter names only tools the host registers.

Use `allow` where a prompt on every call would only add friction: every agent keeps `webfetch: allow`, since an `ask` gate prompted on each lookup and the directive already says when to use the web. Reserve `deny` and `ask` for structural boundaries: the reviewer cannot edit, its shell defaults to `ask` with a read-only allowlist, and the main agent may dispatch only the reviewer.

From `@maestria/opencode` 0.9.0 the generation input still writes each agent's permissions as a V1-style map, then translates it entry by entry into ordered OpenCode V2 `permissions` rules (`bash` to `shell`, `task` to `subagent`, scalar effects on resource `*`). Both versions are last-match-wins, so the effective policy is unchanged.

Audit permissions after adding or removing agents, and include server-prefixed MCP tools: denying built-in tools does not deny MCP access, and a renamed or new server needs fresh evidence.

## Security Boundaries

An OpenCode permission glob is coarse host configuration, not token-level command parsing. A glob shaped like the guarded Git prefix in [OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md) is not evidence of that policy. Before calling any permission host-enforced, record a live probe with the host version, agent, tool, representative command, returned decision, and process result; until then, call it configured policy.

## Consequences

- Frontmatter stays small and reflects real tools; policy stays readable in the directives.
- Fewer prompts for routine work, at the cost of relying on the model for choices a permission cannot express.
- Prompt-only restraint is advisory wherever no permission backs it.

## Alternatives Considered

- **`webfetch: ask` for research agents:** tried and reverted because it prompted on every lookup without a policy benefit.
- **Fine-grained policy in permission flags:** rejected because globs cannot express it and the frontmatter grows unreadable.
- **A main agent denied read, edit, and shell so it must delegate:** used until 2026-10-28. Granting it read tools made it work around delegation, which was taken as proof that only denial enforces routing. The main-loop eval in CORE-035 showed the delegating design cost about three times the tokens with no better outcomes, so the main agent now does the work itself.
- **A plugin hook to stop MCP use bypassing delegation:** not adopted; per-server denial is the response if that becomes observed behavior.

## Date

2026-06-13
