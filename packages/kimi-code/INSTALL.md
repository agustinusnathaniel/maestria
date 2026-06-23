# Installation — @maestria/kimi-code

`@maestria/kimi-code` is a declarative Kimi Code plugin — a manifest, a directory of skill files, and a global rules file. There is no `npm install`, no build step. The plugin is loaded by Kimi Code at session start, and the orchestrator skill auto-injects the methodology.

## Quick Install

In a Kimi Code session:

```
/plugins install https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code
```

## Post-Install Checklist

1. **Copy global rules** — Kimi Code auto-loads `~/.kimi-code/AGENTS.md` at session start, but the plugin cannot install it there. Copy manually:

   ```bash
   mkdir -p ~/.kimi-code
   cp rules/AGENTS.md ~/.kimi-code/AGENTS.md
   ```

   Verify with `ls ~/.kimi-code/AGENTS.md`.

2. **Add hooks and permission rules** — see the [full installation guide](https://maestria.dev/kimi-code/getting-started/installation/) for the required `[[hooks]]` and `[[permission.rules]]` blocks to add to `~/.kimi-code/config.toml`.

3. **Reload and start a new session** — `/reload` then `/new`.

## Troubleshooting

- **Orchestrator not loading**: Check `/plugins list` — maestria should show `enabled: true`. Run `/reload` then `/new`.
- **AgentSwarm not available**: Requires Kimi Code v0.12.0+. On older versions, falls back to parallel Agent calls.
- **AGENTS.md gets truncated**: Kimi Code enforces a 32 KB budget. Keep rules concise.

## Full Guide

For the complete installation walkthrough with hooks, permission rules, and verification steps, see:

[https://maestria.dev/kimi-code/getting-started/installation/](https://maestria.dev/kimi-code/getting-started/installation/)
