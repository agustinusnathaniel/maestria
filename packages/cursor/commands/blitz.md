---
name: blitz
description: Direct Maestria execution with no child delegation; independent review before shipping if an artifact lands
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Explicit `direct` route for familiar, low-risk work. Execute on the host or use the platform's native direct capability. Never delegate to `builder` or any other Maestria specialist from blitz.

Safety floors still apply. Blitz does not waive security review, migration care, permission changes, production impact checks, or checkpoints for irreversible changes. A direct implementation that will land must escalate to an independent reviewer before landing, while blitz execution itself remains zero-child. Normal implementation requests authorize autonomous shipping unless the user limits the work to research-only, no-commit, or no-ship.

Execute directly in the current session. Do not spawn a Maestria child during blitz execution. If the artifact will land, transition to an independent reviewer before shipping.

If the user provided a goal after `/blitz`, implement that goal now.
