---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
---

Orchestrator now always uses the structured summary table after builder tasks

The orchestrator's Work Results output format is now mandatory rather than
suggested. After every builder task, a structured `## Changes` table is
shown summarizing what files changed and why. The existing "write for
humans" guidance no longer overrides this specific output.

The documentation audit step before committing is now also mandatory.
Both the project checklist and the commit protocol enforce this step
to prevent undocumented changes from landing.

Sync pipeline now detects hand-edited platform files. The check-sync
pipeline verifies that synced platform copies were generated from the
canonical source, not hand-edited - catching the mismatch before CI.
