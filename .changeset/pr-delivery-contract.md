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

Restore a consistent PR delivery contract.

- Titles use explicit Conventional Commits; bodies use literal ## headings in order (Summary, Changes, Verification, plus Visual evidence and Breaking changes when applicable), respecting explicit project templates.
- Changes carries the Work Results table (File, What changed, Why); Verification carries checks, results, and unresolved gaps.
- Pushes that change the cumulative diff or verification evidence update the PR title and body with a published-body readback. Acceptance classifies visual evidence as required or not applicable with reason, carries it through briefs, checks rendered coverage in review, reads back the published body at delivery, and treats an open PR as complete only with its applicable evidence.

Also restores proportional documentation assessment: internal docs, user-facing docs, changelog/release notes, and required changesets are assessed separately, only affected categories are updated, plausible unaffected categories note a reason, and required docs carry through briefs to reconciliation.
