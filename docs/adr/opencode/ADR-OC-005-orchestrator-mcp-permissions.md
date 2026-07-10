# ADR-OC-005: Orchestrator MCP Tool Permissions

## Status

Proposed

## Context

### The Question

Should the orchestrator agent's MCP tool access be blocked? The orchestrator is a pure dispatcher - its job is to decompose tasks and delegate to the seven specialists via `task()` and `question()`. By design, it should not read files, grep contents, fetch web pages, or run arbitrary bash commands. But MCP tools like `codegraph_explore` offer powerful code intelligence that cuts across those boundaries: they read source code, trace call paths, and surface blast radius information. For a dispatcher that should never do its own reconnaissance, MCP access is a potential workaround.

### Current State

The orchestrator's permission block in `packages/opencode/sync.config.ts` is tightly locked down:

```yaml
permission:
  read: deny
  glob: deny
  grep: deny
  lsp: deny
  webfetch: deny
  edit: deny
  bash:
    '*': deny
    'npx --yes skills@latest *': allow
```

These permissions control OpenCode's built-in tools. MCP tools are not built-in - they are registered separately via the `mcp` config key in `opencode.jsonc`. The user's config has a single MCP server:

```jsonc
"mcp": {
  "codegraph": {
    "type": "local",
    "command": ["codegraph", "serve", "--mcp"],
    "enabled": true
  }
}
```

OpenCode's permission system defaults to `"allow"` for any tool not explicitly listed. Since MCP tools are not built-in tools, none of the orchestrator's `deny` rules apply to them. The orchestrator implicitly has full access to `codegraph_explore` - the same structural bypass that motivated the OC-001 read-side lockdown.

### Precedent from ADR OC-001

During the OC-001 session, the orchestrator was briefly granted `read/glob/grep: allow` with a 3-call-per-task cap. In practice, the orchestrator consistently used these tools to investigate code directly rather than delegating to `@adventurer`. The experiment was reverted with the conclusion captured in OC-001:

> "Structural permission denial is the only reliable enforcement for an LLM-based orchestrator."

This same pattern applies to MCP tools. If the orchestrator can `codegraph_explore` its way through a codebase, it has little incentive to delegate - and the entire pipeline architecture (dispatcher -> specialist -> verifier) breaks down.

## Investigation

### OpenCode's MCP Permission Model

OpenCode fully supports per-agent MCP tool restrictions. Three mechanisms exist:

| Mechanism | Where | Description |
| --- | --- | --- |
| Agent frontmatter permissions | Agent YAML frontmatter | `codegraph_*: deny` in the orchestrator's permission block |
| Global config `tools` | `opencode.jsonc` | `"codegraph_*": false` in `tools`, then per-agent opt-in |
| Plugin hooks | Plugin package | `permission.ask` hook to intercept MCP tool calls |

### Naming Convention

MCP tools are registered with the server name as a prefix joined by underscore. For the `codegraph` server, the tool is exposed as `codegraph_explore`. This means glob patterns work naturally:

- `codegraph_*: deny` - blocks all tools from the codegraph server
- `codegraph_explore: ask` - prompts on each use (not recommended for a dispatcher)
- `codegraph_explore: deny` - blocks a specific tool

This pattern applies to any MCP server: a server named `my-server` exposes tools as `my-server_tool_name`.

### No Generic MCP Deny Key

There is no `mcp: deny` shortcut. Each MCP server's tools must be denied explicitly by their server-prefixed names. If multiple MCP servers are configured, each requires its own deny entry.

### Options Considered

**Option A: Per-server explicit blocking (recommended if revisited)**

Add `codegraph_*: deny` to the orchestrator's permission block in `sync.config.ts`. This would structurally prevent `codegraph_explore` from being available to the dispatcher, matching the existing pattern for `read`, `glob`, `grep`, etc.

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

Pro: Structural enforcement - matches OC-001's conclusion. Con: Adds a config dependency on the MCP server name. If the server is renamed or replaced, the deny rule becomes stale. Con: Would not cover any future MCP servers unless each is added explicitly.

**Option B: Plugin-level blanket denial via permission hook**

Implement a `permission.ask` plugin hook in `@maestria/opencode` that denies MCP tool calls for the orchestrator agent. This could use a broader heuristic (e.g., deny any tool whose name contains an underscore and matches no built-in tool).

Pro: Covers all MCP servers automatically, past and future. Con: High complexity for a theoretical problem. Plugin hooks are advanced API surface. The heuristic is fragile - OpenCode may add new built-in tools that happen to contain underscores. Con: Premature abstraction for a single MCP server.

**Option C: Prompt-level prohibition only (current approach)**

Rely on the orchestrator's prompt and rules to discourage MCP tool use. No structural changes.

Pro: Zero config overhead. No risk of breaking MCP-dependent workflows. Con: Behavioral enforcement only - same pattern that failed for read/glob/grep in OC-001.

## Decision

No structural change at this time. The current configuration (implicit allow for MCP tools) is accepted.

Two reasons support this decision:

1. **Only one MCP server is in play.** The user's config has a single MCP server (`codegraph`). The orchestrator's prompt-level constraints - it is told to delegate, not investigate - have been sufficient so far. The blast radius concern from OC-001 (read-side tools being used to avoid delegation) is real, but the current MCP surface is small enough that prompt-level guidance is a reasonable default.

2. **The OC-001 read-side experiment's lesson is noted but scoped differently.** The orchestrator's read/glob/grep bypass was systematic and happened within a single session. MCP tool access is narrower: `codegraph_explore` is a single tool, not a family of general-purpose capabilities. If the orchestrator is observed using `codegraph_explore` to investigate code instead of delegating to `@adventurer`, this decision should be revisited with Option A.

If revisited, **Option A (per-server explicit blocking via `codegraph_*: deny`)** is the recommended approach. It matches the existing permission pattern, is straightforward to implement, and is visible in the `sync.config.ts` diff.

## Consequences

### Positive

- No config changes needed - the sync pipeline and agent frontmatter remain untouched.
- No risk of breaking MCP-dependent workflows for other agents that legitimately use `codegraph_explore`.
- The decision is easy to revisit: one line in `sync.config.ts`.

### Negative

- MCP tools remain a blind spot in the orchestrator's permission lockdown. The implicit `"allow"` default applies to any MCP tool, not just `codegraph_explore`.
- Behavioral constraints (prompt-level rules) are the sole enforcement mechanism. ADR OC-001 demonstrated that this is unreliable for a determined orchestrator.
- If MCP servers are added in the future (e.g., Sentry, Context7, a database MCP), each would be implicitly available to the orchestrator unless explicitly denied.

### Revisit Trigger

If the orchestrator is observed using `codegraph_explore` to bypass `@adventurer` delegation, this decision should be revisited. The recommended path is Option A: add `codegraph_*: deny` to the orchestrator's permission block.

## Lessons Learned

1. **MCP tools are a permission blind spot.** The OC-001 audit covered built-in tools comprehensively but did not account for MCP tools, which are registered outside the built-in permission system and default to `"allow"`. Any future permission audit should include MCP tools in scope.

2. **`serverName_toolName` is the permission key for MCP tools.** OpenCode registers MCP tools with the server name as a prefix joined by underscore. Glob patterns like `codegraph_*: deny` work naturally against this convention. The same pattern applies to any MCP server: `my-server_*` blocks all tools from that server.

3. **No generic `"mcp": "deny"` key exists.** Unlike `read`, `edit`, or `bash`, there is no single permission key for "all MCP tools." Each server must be denied explicitly. This is by design - MCP servers are named entities - but it means blocking a new MCP server always requires an explicit config change.

4. **Plugin hooks are an option but not warranted yet.** Option B (plugin-level blanket denial) is technically possible but premature for a single MCP server. It should be revisited if the number of MCP servers grows or if the orchestrator demonstrates systematic MCP workaround behavior.

5. **The OC-001 lesson generalizes but with nuance.** Structural permission denial remains the only reliable enforcement for an LLM orchestrator. However, the scope matters: a single, narrow MCP tool is lower risk than the full read/glob/grep family. The threshold for action should be observed behavior, not theoretical risk.

## Date

2026-07-03
