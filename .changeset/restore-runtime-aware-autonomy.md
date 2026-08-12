---
'@maestria/core': patch
'@maestria/claude-code': patch
'@maestria/cursor': patch
'@maestria/hermes': patch
'@maestria/kimi-code': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/pi': patch
---

Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.
