---
'@maestria/claude-code': patch
---

Claude Code plugin metadata now stays aligned with package versions: release-time version sync is generalized across plugins (replacing the Hermes-only script) and a `--check` mode fails the build on drift, so the published plugin artifact can no longer diverge from npm metadata. Local usage, installation, quick-start, and contributing docs are now available on the docs site.
