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

Simplify the shared agent directive around outcome, evidence, safety, delegation, blind review, and bounded repair. Runtime adapters now determine whether the orchestrator may work directly or must dispatch, while generated projections and behavioral contract tests remain synchronized.
