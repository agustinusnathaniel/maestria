---
"maestria": minor
"@maestria/opencode": patch
"@maestria/claude-code": patch
"@maestria/codex": patch
"@maestria/cursor": patch
"@maestria/kimi-code": patch
"@maestria/omp": patch
"@maestria/pi": patch
"@maestria/prime-agent": patch
"@maestria/agent-plugin": patch
---

Install, update, and reconcile the `create-pull-request` methodology skill through the official `skills` CLI instead of bundling skill bodies into plugins. `install` and `update` accept `--skills` (CSV, or `none`), `--exclude-skills` (CSV), and `--yes`; per-platform selections persist only after actual success, independently installed copies are never adopted or deleted, and shared native skill directories are preserved while another owned platform still uses them. The visual-evidence procedure lives once in the root skill, with the core and integration routers pointing at it.
