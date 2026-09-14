# ADR-OC-005: Orchestrator MCP Tool Permissions

## Status

Accepted (2026-07-03)

## Context

### The Question

Should the orchestrator agent's MCP tool access be blocked? The orchestrator is a pure dispatcher: it decomposes tasks and delegates to seven specialists via `task()` and `question()`, and by design it should not read files, grep, fetch web pages, or run arbitrary bash. MCP tools like `codegraph_explore` cut across those boundaries by reading source, tracing call paths, and surfacing blast radius, making MCP access a potential workaround.

### Current State

The orchestrator's permission block denies the built-in `read`, `glob`, `grep`, `lsp`, `webfetch`, and `edit` tools and allow-lists only `npx --yes skills@latest *` for bash. MCP tools register separately via the `mcp` key in `opencode.jsonc` (currently one `codegraph` server), and unlisted tools default to `"allow"`, so no deny rule applies: the orchestrator implicitly has full `codegraph_explore` access, the same bypass that motivated the OC-001 read-side lockdown.

### Precedent from ADR OC-001

OC-001 briefly granted the orchestrator `read/glob/grep: allow` with a 3-call-per-task cap; it consistently investigated code directly instead of delegating, and the experiment was reverted with the conclusion captured there:

> "Structural permission denial is the only reliable enforcement for an LLM-based orchestrator."

The same applies to MCP tools: a `codegraph_explore`-capable orchestrator has little incentive to delegate, and the dispatcher -> specialist -> verifier pipeline breaks down.

## Investigation

### OpenCode's MCP Permission Model

OpenCode supports per-agent MCP restrictions through three mechanisms:

| Mechanism | Where | Description |
| --- | --- | --- |
| Agent frontmatter permissions | Agent YAML | `codegraph_*: deny` in the orchestrator's permission block |
| Global config `tools` | `opencode.jsonc` | `"codegraph_*": false`, then per-agent opt-in |
| Plugin hooks | Plugin package | `permission.ask` hook to intercept MCP tool calls |

### Naming Convention

MCP tools use the server name as an underscore-joined prefix, so the `codegraph` server exposes `codegraph_explore` and glob patterns work naturally:

- `codegraph_*: deny` - blocks all tools from the codegraph server
- `codegraph_explore: ask` - prompts on each use (not recommended for a dispatcher)
- `codegraph_explore: deny` - blocks one tool

This applies to any MCP server: a server named `my-server` exposes `my-server_tool_name`.

### No Generic MCP Deny Key

There is no `mcp: deny` shortcut; each server's tools must be denied explicitly by their server-prefixed names.

### Options Considered

**Option A: Per-server explicit blocking (recommended if revisited)**

Add `codegraph_*: deny` to the orchestrator's permission block, structurally preventing `codegraph_explore` from reaching the dispatcher and matching the existing pattern for `read`, `glob`, `grep`, etc.

```yaml
permission:
  read: deny
  glob: deny
  grep: deny
  lsp: deny
  webfetch: deny
  edit: deny
  codegraph_*: deny # new
  bash:
    '*': deny
    'npx --yes skills@latest *': allow
```

Pro: structural enforcement, matching OC-001's conclusion. Con: depends on the MCP server name (a rename makes it stale), and future servers need their own entries.

**Option B: Plugin-level blanket denial via permission hook**

Implement a `permission.ask` hook in `@maestria/opencode` that denies MCP calls for the orchestrator, e.g. by rejecting tool names containing an underscore that match no built-in.

Pro: covers all MCP servers automatically. Con: high complexity for a theoretical problem, advanced plugin API surface, and a fragile underscore heuristic; premature abstraction for one server.

**Option C: Prompt-level prohibition only (current approach)**

Rely on the orchestrator's prompt and rules to discourage MCP tool use.

Pro: zero config overhead; no risk of breaking MCP-dependent workflows. Con: behavioral enforcement only - the same pattern that failed for read/glob/grep in OC-001.

## Decision

No structural change at this time; the current configuration (implicit allow for MCP tools) is accepted.

Two reasons support this:

1. **Only one MCP server is in play.** The orchestrator's prompt-level constraints (delegate, do not investigate) have been sufficient, and the surface is a single narrow tool. The OC-001 blast-radius concern is real but does not yet warrant config changes.
2. **The OC-001 lesson is scoped differently.** The read/glob/grep bypass was systematic; MCP access is one tool, not a family of general-purpose capabilities. If the orchestrator is observed using `codegraph_explore` instead of delegating to `@adventurer`, revisit with Option A.

If revisited, **Option A (per-server explicit blocking via `codegraph_*: deny`)** is recommended: it matches the existing permission pattern, is straightforward to implement, and is visible in the config diff.

Reviewed 2026-09-10: the orchestrator permission block still has no explicit MCP deny, so the no-structural-change decision remains in effect and the revisit trigger is unchanged.

## Consequences

### Positive

- No config changes; the sync pipeline and agent frontmatter remain untouched.
- No risk of breaking MCP-dependent workflows for agents that legitimately use `codegraph_explore`.
- Easy to revisit: one line in the permission block.

### Negative

- MCP tools remain a blind spot in the orchestrator's permission lockdown; the implicit `"allow"` default covers any MCP tool, not just `codegraph_explore`.
- Behavioral constraints are the sole enforcement mechanism, and ADR OC-001 showed this is unreliable for a determined orchestrator.
- Future MCP servers (e.g., Sentry, Context7, a database MCP) would be implicitly available unless explicitly denied.

### Revisit Trigger

If the orchestrator is observed using `codegraph_explore` to bypass `@adventurer` delegation, revisit this decision and add `codegraph_*: deny` to the orchestrator's permission block.

## Lessons Learned

1. **MCP tools are a permission blind spot.** The OC-001 audit covered built-ins comprehensively but not MCP tools, which sit outside that system and default to `"allow"`; future permission audits should include them.
2. **`serverName_toolName` is the permission key for MCP tools.** Glob patterns like `codegraph_*: deny` work against this convention; `my-server_*` blocks a whole server.
3. **No generic `"mcp": "deny"` key exists.** Each server must be denied explicitly, so blocking a new MCP server always requires a config change.
4. **Plugin hooks are an option but not warranted yet.** Option B is premature for a single MCP server; revisit if the server count grows or MCP workaround behavior becomes systematic.
5. **The OC-001 lesson generalizes with nuance.** Structural permission denial remains the only reliable enforcement for an LLM orchestrator, but one narrow MCP tool is lower risk than the full read/glob/grep family; act on observed behavior, not theoretical risk.

## Date

2026-07-03
