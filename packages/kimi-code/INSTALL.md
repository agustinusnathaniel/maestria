# Installation — @maestria/kimi-code

Step-by-step setup for the maestria agent pack on Kimi Code.

## Prerequisites

- **Kimi Code v0.12.0+** — required for the `AgentSwarm` tool
  (Kimi Code added first-class swarm support in v0.12.0). If you're on
  an older build, the orchestrator skill will still work, but the
  swarm guidance falls back to single `Agent` calls.
- **No Node toolchain required** — the plugin is purely declarative
  files (manifest + markdown). No `npm install`, no `pnpm install`,
  no build step.

## Steps

### 1. Install the plugin (REQUIRED)

In a Kimi Code session, run:

```
/plugins install https://github.com/maestria/maestria
```

By default, Kimi Code follows the **latest release** of the
`maestria/maestria` repository. To pin a specific version, use one of:

- **Tag**: `/plugins install https://github.com/maestria/maestria/releases/tag/v0.1.0`
- **Branch**: `/plugins install https://github.com/maestria/maestria/tree/main#branch`
- **SHA**: `/plugins install https://github.com/maestria/maestria/tree/abc1234#sha`

> Tip: For production work, pin to a tag or SHA. For trying the latest,
> the default URL is fine.

### 2. Place global rules (REQUIRED)

Kimi Code auto-loads `AGENTS.md` from a few locations (see
`packages/agent-core/src/profile/context.ts:48-65`). The first
location it checks is `$KIMI_CODE_HOME/AGENTS.md` (default
`~/.kimi-code/AGENTS.md`). Copy the bundled rules file there:

```bash
mkdir -p ~/.kimi-code
cp packages/kimi-code/rules/AGENTS.md ~/.kimi-code/AGENTS.md
```

> The plugin ships the file as `rules/AGENTS.md`, but the plugin
> itself cannot install it (Kimi Code does not expose a plugin
> mechanism to write to `~/.kimi-code/`). You must copy it manually.

**Verify:**

```bash
ls -la ~/.kimi-code/AGENTS.md
```

> The file must stay under **32 KB**. If you customize it heavily,
> watch the size — Kimi Code truncates AGENTS.md content past 32 KB
> with a marker (`profile/context.ts:8-10`).

### 3. Add lifecycle hooks to `config.toml` (OPTIONAL — recommended)

Open `~/.kimi-code/config.toml` (or `$KIMI_CODE_HOME/config.toml`)
and add the following `[[hooks]]` blocks. The hooks are sourced from
Kimi Code's official docs (`docs/en/customization/hooks.md`) and
provide three affordances: block destructive bash, inject a per-turn
orchestrator reminder, and observe compaction cycles.

```toml
# Block destructive bash commands. The script below matches Kimi Code's
# example and is the recommended minimum; tighten for your environment.
[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node ~/.kimi-code/hooks/block-dangerous-bash.mjs"
timeout = 5

# Append a session-start reminder to every user message. This is the closest
# available approximation of OpenCode's system.transform text injection:
# the hook can return text on stdout, which Kimi Code appends to the context.
[[hooks]]
event = "UserPromptSubmit"
matcher = ""
command = "echo 'Maestria active: delegate via the orchestrator skill. Prefer adventurer for recon, architect for design, builder for implementation, diagnose for bugs, reviewer for QA, writer for docs, planner for multi-phase work.'"
timeout = 5

# Observe compaction cycles. These are observation-only — return values are
# ignored — but useful for logging.
[[hooks]]
event = "PreCompact"
matcher = ".*"
command = "echo \"compact start: $(date -Is)\" >> ~/.kimi-code/compact.log"
timeout = 5

[[hooks]]
event = "PostCompact"
matcher = ".*"
command = "echo \"compact end:   $(date -Is)\" >> ~/.kimi-code/compact.log"
timeout = 5
```

The companion script `~/.kimi-code/hooks/block-dangerous-bash.mjs` is
the example from Kimi Code's docs verbatim (it returns exit code 2 to
block, with `console.error` describing why):

```js
let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  const command = payload.tool_input?.command ?? "";
  if (command.includes("rm -rf")) {
    console.error("Dangerous command detected, blocked");
    process.exit(2);
  }
});
```

Save this file as `~/.kimi-code/hooks/block-dangerous-bash.mjs`. The
`UserPromptSubmit` hook provides a per-turn reminder of the
orchestrator's specialist routing — useful if the user navigates away
from the orchestrator skill's session-start guidance.

### 4. Add permission rules (REQUIRED — for safety)

By default, the 3 built-in Kimi Code subagents have full tool access
(see `profile/default/{coder,explore,plan}.yaml`). The `reviewer` and
`adventurer` personas _describe_ safety constraints in their SKILL.md
text ("do not edit files", "read-only Bash"), but those constraints
are advisory only — they live in the prompt, not the tool layer. The
`[[permission.rules]]` blocks below are what actually _enforce_ the
persona boundaries at the tool layer. Without them, a misbehaving
subagent can still write or edit files. The conservative minimum for
maestria:

```toml
# Builder (coder) — full access
[[permission.rules]]
tool = "Bash"
scope = "session-runtime"
allow = ["git status*", "git diff*", "git log*", "npm test*", "pnpm test*", "npx tsc*"]

# Adventurer (explore) — read-only
[[permission.rules]]
tool = "Write"
scope = "session-runtime"
deny = ["*"]

[[permission.rules]]
tool = "Edit"
scope = "session-runtime"
deny = ["*"]

# Reviewer (coder) — no editing
[[permission.rules]]
tool = "Write"
scope = "session-runtime"
deny = ["*"]

[[permission.rules]]
tool = "Edit"
scope = "session-runtime"
deny = ["*"]
```

The `scope` field provides **temporal** granularity (`turn-override`,
`session-runtime`, `project`, `user`) — it is not per-subagent
granularity. Subagent tool lists come from the hardcoded profile
(`coder`/`explore`/`plan`), not from per-agent rules. These rules
are the **only tool-layer enforcement** of the persona boundaries
declared in each specialist's SKILL.md. The `reviewer/SKILL.md`
persona opens with "Do not edit files" and the `adventurer/SKILL.md`
persona scopes to read-only Bash — these rules make those
constraints binding, not just suggested.

### 5. Reload plugins and start a new session (REQUIRED)

Plugin changes only take effect in new sessions. After installing,
enabling, or removing a plugin, run `/reload` to reload the plugin
manifest, then `/new` to open a session that uses it.

### 6. Verify (REQUIRED)

In a fresh session, ask:

> "I need to refactor 8 different API endpoints to use the new error
> format. How would you approach that?"

The orchestrator should:

1. Auto-load (via `sessionStart.skill`).
2. Identify the work as ≥3 uniform items → use `AgentSwarm` with the
   `builder` persona.
3. Dispatch a swarm across the 8 endpoints.

If the orchestrator starts writing code directly, something is wrong
with the install — check that the plugin appears under
`/plugins list` and that the session-start skill loaded.

## Troubleshooting

### Orchestrator not loading

- Check `/plugins list` — `maestria` should appear with `enabled: true`.
- Check `~/.kimi-code/AGENTS.md` exists (the session-start skill is in
  the plugin; the global rules are in AGENTS.md).
- Restart Kimi Code completely (not just the session).

### 7 specialists not visible

- The specialists are loaded via the `Skill` tool, not auto-loaded at
  session start. The orchestrator loads them on demand.
- Use `/skill:builder`, `/skill:adventurer`, etc. to manually load a
  specialist skill.

### `AgentSwarm` not available

- Requires Kimi Code v0.12.0+ for first-class swarm support. On older
  versions, the orchestrator's swarm guidance falls back to parallel
  `Agent` calls in separate turns.

### AGENTS.md gets truncated

- The 32 KB budget is enforced at `profile/context.ts:8-10`. If your
  customizations push the file over, Kimi Code inserts a truncation
  marker and drops the rest. Trim verbose sections.

## Updating

Kimi Code follows the latest release by default. To update:

```
/plugins install https://github.com/maestria/maestria
```

Or pin to a specific tag/SHA via the URL forms above.

> **Warning:** updates overwrite any local edits to the bundled
> SKILL.md files. If you've customized them, fork the repository or
> back up your changes before re-installing.

## Uninstalling

```
/plugins uninstall maestria
rm ~/.kimi-code/AGENTS.md
```

(Optionally) remove the `[[hooks]]` and `[[permission.rules]]` blocks
from `~/.kimi-code/config.toml`.
