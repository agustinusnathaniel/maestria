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

Add the `docs-update` methodology skill as a standalone root skill and distribute it through the existing skills CLI selection. Fresh installs default to `create-pull-request` plus `docs-update`; recorded per-platform choices (including `[]`) are preserved exactly, and updates of legacy installs without a record infer only `create-pull-request`, never silently adding the new skill. The selection record moves to version 2 only with per-skill observed source/path; reconcile, preflight, removal guards, and uninstall now operate per skill with partial successes recorded recoverably and failed skills never marked installed. Interactive update still reviews skills with final confirmation when plugins are already current. Core keeps only a short docs obligation plus the skill pointer.
