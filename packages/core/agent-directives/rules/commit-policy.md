# Commit Policy

- **Only the orchestrator authorizes commits.** Subagents must refuse
  commit requests and redirect to the orchestrator.
- **Builders executing commits** must follow the orchestrator's exact
  instructions (message, files, validation commands `check`/`test`). Flag it if the
  orchestrator's instructions skip the commit protocol.
- **Plans must not include implicit commit steps.** Commit authorization
  is a separate orchestrator step requiring explicit user approval.
