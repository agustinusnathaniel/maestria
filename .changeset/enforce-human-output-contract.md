---
'@maestria/claude-code': patch
'@maestria/codex': patch
'@maestria/core': patch
'@maestria/cursor': patch
'@maestria/kimi-code': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/prime-agent': patch
---

Enforce a shared human-facing output contract across all agent projections. Authored responses, comments, commits, pull request metadata, and documentation must avoid Unicode U+2014 while preserving code syntax, intentional literals, quoted source text, and user-provided text.
