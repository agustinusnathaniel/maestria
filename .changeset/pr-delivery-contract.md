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

Restore a consistent PR delivery contract: titles are explicit Conventional Commits, bodies use literal ## headings in order (Summary, Changes, Verification, plus Visual evidence and Breaking changes when applicable) while respecting explicit project templates. Changes holds the Work Results table (File, What changed, Why columns), Verification carries checks, results, and unresolved gaps, and any push changing the cumulative diff or verification evidence updates the PR title and body with a published-body readback. Acceptance classifies visual evidence as required or not applicable with reason and carries it through briefs, review checks rendered coverage, delivery reads back the published body, and an open PR is complete only with its applicable acceptance evidence.
