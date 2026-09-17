---
"@maestria/agent-plugin": patch
"@maestria/claude-code": patch
"@maestria/codex": patch
"@maestria/cursor": patch
"@maestria/hermes": patch
"@maestria/kimi-code": patch
"@maestria/omp": patch
"@maestria/opencode": patch
"@maestria/pi": patch
"@maestria/prime-agent": patch
---

Tighten the visual delivery evidence contract: capture, handoff, publication in the PR body, and delivery-owner readback are distinct stages. Local paths and session-log references no longer count as PR-body evidence, missing required evidence is incomplete with the checked limitation, and final reconciliation calls out PR-body evidence with readback. PR presentation stays concise and comparable without fabricated baselines, and affected evidence is refreshed with obsolete PR body references removed before delivery or re-delivery.
