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

Consolidate duplicated agent directive text without changing behavior.

- The human-facing output contract now lives once in the shared global rules; specialist prompts point at it instead of restating it, keeping per-specialist scope and trigger wording.
- Dense rules prose is split into scannable paragraphs with identical wording, and restated adventurer/architect wording is collapsed.
- No obligation was moved without a pointer, retired, or weakened; all directive contract tests pass unmodified.
