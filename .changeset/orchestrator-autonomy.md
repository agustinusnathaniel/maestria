---
'@maestria/pi': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/core': patch
---

fix: restore orchestrator autonomy while keeping maker/checker split

The pure-dispatcher enforcement blocked ALL orchestrator tools (read,
grep, bash, edit) when a workflow mode was active. When specialist
dispatch timed out or the model omitted the agent name, the orchestrator
had zero fallback and aborted - the reported "lacks autonomy, behaves
weirdly" symptom.

- Orchestrator regains read-only tools (read, glob, grep, lsp, webfetch,
  read-only bash, tests) for routing and verification; mutations remain
  denied and delegated.
- Dispatch failure is no longer an idle state: one corrected-brief retry,
  then read-only recon + precise blocked-state reporting. Never mutates
  directly, never waives route/review floors.
- maestria_subagent now requires `agent` and `task` and returns an
  actionable message listing valid agents instead of throwing an opaque
  "Unknown agent: undefined".
- Subagent poll timeout raised 60s -> 180s.
- OpenCode projection: orchestrator permission frontmatter updated to
  allow read-only tools; sync regenerated all platform projections.
