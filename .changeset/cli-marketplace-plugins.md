---
"maestria": minor
"@maestria/codex": patch
---

Add Maestria CLI compatibility for the Claude Code and Codex CLI plugin packages. The CLI detects
both hosts, stages the published npm package into a local marketplace, and delegates install,
update, status, check, and uninstall operations to the host plugin manager.
