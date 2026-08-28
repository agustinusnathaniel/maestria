---
'@maestria/opencode-v2': patch
---

Removed package-local sync/prebuild scripts. Canonical-content regeneration stays owned by the root sync pipeline (scripts/sync-all) and verification by scripts/check-sync via pnpm check.
